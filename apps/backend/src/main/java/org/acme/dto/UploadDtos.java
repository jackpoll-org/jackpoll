package org.acme.dto;

/**
 * Upload-related DTOs. Mirrors the frontend type in
 * {@code survey-frontend/app/types/survey.ts} ({@code UploadedFile}).
 */
public final class UploadDtos {

    private UploadDtos() {}

    public record UploadResult(
        String key,
        String url,
        String filename,
        String contentType,
        long size
    ) {}
}
