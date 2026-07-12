package org.acme.resource;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.regex.Pattern;

import org.acme.dto.ApiResponse;
import org.acme.exception.InvalidUploadException;
import org.acme.exception.RateLimitedException;
import org.acme.service.RateLimiterService;
import org.acme.service.StorageService;
import org.acme.service.StorageService.ObjectContent;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import io.quarkus.security.Authenticated;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/uploads")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class UploadResource {

    /** Only ever serve generated upload keys — blocks traversal / arbitrary reads. */
    private static final Pattern KEY = Pattern.compile(
        "uploads/[A-Za-z0-9-]+\\.(?:jpg|png|gif|webp)");

    @Inject
    StorageService storage;

    @Inject
    RateLimiterService rateLimiter;

    @ConfigProperty(name = "survey.upload.rate-limit.max", defaultValue = "20")
    int uploadRateLimitMax;

    @ConfigProperty(name = "survey.upload.rate-limit.window-seconds", defaultValue = "60")
    long uploadRateLimitWindowSeconds;

    // Anonymous on purpose: public survey respondents upload files (issue #3)
    // and signatures. StorageService validates content type (images only) + size
    // and optionally virus-scans, so anonymous upload can't store arbitrary data.
    @POST
    @PermitAll
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response upload(
        @RestForm("file") FileUpload file,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        // Throttle this anonymous, storage-writing endpoint per client IP so it
        // can't be abused to fill object storage (validation still runs below).
        String ip = clientIp(forwardedFor, http);
        if (!rateLimiter.allow("upload|" + (ip == null ? "unknown" : ip),
                uploadRateLimitMax, uploadRateLimitWindowSeconds)) {
            throw new RateLimitedException(
                "Too many uploads. Please wait a moment and try again.");
        }
        if (file == null) {
            throw new InvalidUploadException("No file provided.");
        }
        try (InputStream in = Files.newInputStream(file.uploadedFile())) {
            var result = storage.upload(file.fileName(), file.contentType(), in, file.size());
            return Response.status(Response.Status.CREATED)
                .entity(ApiResponse.ok(result))
                .build();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read uploaded file", e);
        }
    }

    /**
     * Stream a stored upload to the browser. Anonymous on purpose: survey
     * respondents and public result viewers must load images without a token.
     * The key is pattern-checked so only generated upload objects are served.
     */
    @GET
    @Path("/raw")
    @PermitAll
    @Produces(MediaType.WILDCARD)
    public Response raw(@QueryParam("key") String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new NotFoundException("Upload not found.");
        }
        ObjectContent obj = storage.getObject(key);
        return Response.ok(obj.data())
            .type(obj.contentType())
            // Keys are immutable (random UUID per upload) → cache aggressively.
            .header("Cache-Control", "public, max-age=31536000, immutable")
            // Defense in depth: never let the browser MIME-sniff a stored object
            // into an executable type, and force inline rendering.
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Disposition", "inline")
            .build();
    }

    /**
     * Real client IP for per-IP rate limiting. Traefik appends the true client
     * address as the LAST X-Forwarded-For hop, so take the rightmost hop — the
     * leftmost is attacker-controlled and would mint a fresh bucket per request.
     */
    private static String clientIp(String forwardedFor, io.vertx.core.http.HttpServerRequest http) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            return hops[hops.length - 1].trim();
        }
        return http != null && http.remoteAddress() != null
            ? http.remoteAddress().hostAddress()
            : null;
    }
}
