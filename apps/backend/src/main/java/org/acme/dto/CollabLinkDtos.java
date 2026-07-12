package org.acme.dto;

public final class CollabLinkDtos {

    private CollabLinkDtos() {}

    public record CollabLinkDto(String slug, String expiresAt) {}

    public record UpdateCollabLinkRequest(String expiresAt) {}
}
