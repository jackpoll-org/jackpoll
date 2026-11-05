package org.acme.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class ApiKeyDtos {

    private ApiKeyDtos() {}

    public record CreateApiKeyRequest(@NotBlank @Size(max = 100) String name, boolean readResponses) {}

    public record ApiKeyDto(
        String id,
        String name,
        String prefix,
        List<String> scopes,
        String createdAt,
        String lastUsedAt
    ) {}

    public record CreatedApiKeyDto(ApiKeyDto apiKey, String secret) {}
}
