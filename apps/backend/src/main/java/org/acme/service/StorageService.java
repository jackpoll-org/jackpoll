package org.acme.service;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.acme.dto.UploadDtos.UploadResult;
import org.acme.exception.InvalidUploadException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;

/**
 * Stores uploaded files in MinIO (S3-compatible). The browser never talks to
 * MinIO directly (its host is only reachable inside the cluster); instead it
 * loads images through the upload proxy, which streams object bytes via
 * {@link #getObject(String)}.
 */
@ApplicationScoped
public class StorageService {

    /** Allowed content types → file extension. */
    private static final Map<String, String> ALLOWED_TYPES = Map.ofEntries(
        Map.entry("image/jpeg", "jpg"),
        Map.entry("image/png", "png"),
        Map.entry("image/gif", "gif"),
        Map.entry("image/webp", "webp"),
        Map.entry("image/svg+xml", "svg"),
        Map.entry("application/pdf", "pdf"),
        Map.entry(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
        Map.entry(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
        Map.entry(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
        Map.entry("text/plain", "txt"),
        Map.entry("text/csv", "csv")
    );

    /** Types with no magic-byte signature — trusted only after a text heuristic passes. */
    private static final Set<String> TEXT_TYPES = Set.of("text/plain", "text/csv");

    @Inject
    MinioClient minio;

    @Inject
    ClamAvScanner virusScanner;

    @ConfigProperty(name = "minio.bucket")
    String bucket;

    @ConfigProperty(name = "minio.max-file-size")
    long maxFileSize;

    /** Ensure the bucket exists on startup. */
    void onStart(@Observes StartupEvent event) {
        try {
            boolean exists = minio.bucketExists(
                BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize MinIO bucket: " + bucket, e);
        }
    }

    public UploadResult upload(String filename, String contentType, InputStream data, long size) {
        if (size <= 0) {
            throw new InvalidUploadException("Empty file.");
        }
        if (size > maxFileSize) {
            throw new InvalidUploadException(
                "File exceeds the maximum size of " + (maxFileSize / (1024 * 1024)) + " MB.");
        }

        // Read the bytes once so we can validate content and scan before storing.
        byte[] bytes = readBounded(data);

        // Trust the bytes, not the client header (issue #43): the real type must
        // match a supported format's signature. This blocks renamed/MIME-spoofed
        // uploads. Plain text/CSV have no signature, so those fall back to a
        // printable-text heuristic gated on the client-declared type.
        var detectedType = FileContentValidator.sniffImageType(bytes);
        if (detectedType == null && FileContentValidator.isPdf(bytes)) {
            detectedType = "application/pdf";
        }
        if (detectedType == null) {
            detectedType = FileContentValidator.sniffOoxmlType(bytes);
        }
        if (detectedType == null && FileContentValidator.isSafeSvg(bytes)) {
            detectedType = "image/svg+xml";
        }
        if (detectedType == null
            && TEXT_TYPES.contains(contentType)
            && FileContentValidator.looksLikeText(bytes)) {
            detectedType = contentType;
        }
        if (detectedType == null || !ALLOWED_TYPES.containsKey(detectedType)) {
            throw new InvalidUploadException(
                "Unsupported or corrupt file. Allowed: images (JPG, PNG, GIF, WEBP, SVG), "
                    + "PDF, Word/Excel/PowerPoint, TXT, CSV.");
        }

        // Optional antivirus scan (issue #43) — throws on a detected threat.
        virusScanner.scan(bytes);

        var key = "uploads/" + UUID.randomUUID() + "." + ALLOWED_TYPES.get(detectedType);
        try {
            minio.putObject(PutObjectArgs.builder()
                .bucket(bucket)
                .object(key)
                .stream(new java.io.ByteArrayInputStream(bytes), bytes.length, -1)
                .contentType(detectedType)
                .build());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to store upload", e);
        }

        return new UploadResult(key, publicUrl(key), filename, detectedType, bytes.length);
    }

    /** Read the whole upload, guarding against a body larger than the limit. */
    private byte[] readBounded(InputStream data) {
        try {
            byte[] bytes = data.readAllBytes();
            if (bytes.length > maxFileSize) {
                throw new InvalidUploadException(
                    "File exceeds the maximum size of " + (maxFileSize / (1024 * 1024)) + " MB.");
            }
            return bytes;
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Failed to read upload", e);
        }
    }

    /**
     * Stable, non-expiring display URL routed through the frontend upload proxy
     * ({@code /api/*} → backend {@code /api/v1/*}). Keeps the internal MinIO host
     * out of the browser and survives long after a presigned URL would expire.
     */
    public String publicUrl(String key) {
        return "/api/uploads/raw?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8);
    }

    /** Bytes + content type of a stored object, for streaming to the browser. */
    public record ObjectContent(byte[] data, String contentType) {}

    /**
     * Fetch an object's bytes from MinIO. Throws {@link NotFoundException} when
     * the key does not exist so the resource returns a clean 404.
     */
    public ObjectContent getObject(String key) {
        try (GetObjectResponse res = minio.getObject(GetObjectArgs.builder()
                .bucket(bucket)
                .object(key)
                .build())) {
            String contentType = res.headers().get("Content-Type");
            byte[] data = res.readAllBytes();
            return new ObjectContent(
                data, contentType != null ? contentType : "application/octet-stream");
        } catch (Exception e) {
            throw new NotFoundException("Upload not found: " + key);
        }
    }
}
