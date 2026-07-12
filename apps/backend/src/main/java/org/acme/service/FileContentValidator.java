package org.acme.service;

/**
 * Sniffs the real type of an uploaded file from its leading "magic" bytes
 * (issue #43). The client-declared MIME type is never trusted — a file is
 * accepted only if its actual bytes match a supported image format, which
 * blocks renamed executables and MIME-spoofed uploads.
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
}
