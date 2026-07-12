package org.acme.dto;

public final class ShareLinkDtos {

    private ShareLinkDtos() {}

    public record ShareLinkDto(
        String slug,
        String expiresAt,
        Integer maxResponses,
        long responseCount
    ) {}

    public record UpdateShareLinkRequest(
        String expiresAt,
        Integer maxResponses
    ) {}
}
