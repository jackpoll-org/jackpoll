package org.acme.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class RespondentTokenDtos {

    private RespondentTokenDtos() {}

    public record RespondentTokenDto(String id, String token, String usedAt, String createdAt) {}

    public record GenerateTokensRequest(@Min(1) @Max(1000) int count) {}

    public record AddTokensRequest(
        @NotNull @Size(max = 5000) List<@NotBlank @Size(max = 128) String> tokens
    ) {}
}
