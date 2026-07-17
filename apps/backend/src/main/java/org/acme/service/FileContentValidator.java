package org.acme.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Sniffs the real type of an uploaded file from its leading "magic" bytes
 * (issue #43). The client-declared MIME type is never trusted for formats
 * that have a magic-byte signature — a file is accepted only if its actual
 * bytes match a supported format, which blocks renamed executables and
 * MIME-spoofed uploads. Formats without magic bytes (plain text/CSV) fall
 * back to a content heuristic instead.
 */
public final class FileContentValidator {

    private FileContentValidator() {}

    /**
     * @return the canonical image content-type detected from the bytes, or
     *         {@code null} if the content is not a supported image.
     */
    public static String sniffImageType(byte[] b) {
        if (b == null) return null;

        // JPEG: FF D8 FF
        if (b.length >= 3
            && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (b.length >= 8
            && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
            && (b[4] & 0xFF) == 0x0D && (b[5] & 0xFF) == 0x0A
            && (b[6] & 0xFF) == 0x1A && (b[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        // GIF: "GIF87a" or "GIF89a"
        if (b.length >= 6
            && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8'
            && (b[4] == '7' || b[4] == '9') && b[5] == 'a') {
            return "image/gif";
        }
        // WEBP: "RIFF"????"WEBP"
        if (b.length >= 12
            && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    /** PDF: "%PDF-" leading bytes. */
    public static boolean isPdf(byte[] b) {
        return b != null && b.length >= 5
            && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-';
    }

    /**
     * OOXML (docx/xlsx/pptx) are all ZIP containers sharing the same magic
     * bytes, so the subtype is resolved by looking for the format-specific
     * top-level entry inside the archive (word/, xl/, ppt/).
     *
     * @return the canonical Office content-type, or {@code null} if the bytes
     *         aren't a ZIP or don't match a known Office package layout.
     */
    public static String sniffOoxmlType(byte[] b) {
        if (b == null || b.length < 4
            || b[0] != 'P' || b[1] != 'K' || b[2] != 0x03 || b[3] != 0x04) {
            return null;
        }
        try (var zip = new ZipInputStream(new ByteArrayInputStream(b))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.startsWith("word/")) {
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
                if (name.startsWith("xl/")) {
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                }
                if (name.startsWith("ppt/")) {
                    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                }
            }
        } catch (IOException ignored) {
            return null;
        }
        return null;
    }

    /**
     * SVG has no binary magic bytes — it's XML text. Accept only content that
     * parses as plausible SVG and contains no embedded scripts or inline event
     * handlers, since SVG uploads are a known XSS vector.
     */
    public static boolean isSafeSvg(byte[] b) {
        if (b == null || b.length == 0 || b.length > 2_000_000) return false;
        String text = new String(b, StandardCharsets.UTF_8);
        String lower = text.toLowerCase(Locale.ROOT);
        if (!lower.contains("<svg")) return false;
        if (lower.contains("<script") || lower.contains("javascript:")) return false;
        if (lower.matches("(?s).*\\son[a-z]+\\s*=.*")) return false;
        return true;
    }

    /**
     * Plain text / CSV have no magic bytes either — accept only if the bytes
     * look like genuine text (no NUL bytes, no non-printable control chars)
     * rather than trusting the client-declared content type on its own.
     */
    public static boolean looksLikeText(byte[] b) {
        if (b == null || b.length == 0) return false;
        int checked = Math.min(b.length, 8192);
        for (int i = 0; i < checked; i++) {
            int c = b[i] & 0xFF;
            if (c == 0) return false;
            boolean printableAscii = c == 9 || c == 10 || c == 13 || (c >= 32 && c != 127);
            if (c < 0x80 && !printableAscii) return false;
        }
        return true;
    }
}
