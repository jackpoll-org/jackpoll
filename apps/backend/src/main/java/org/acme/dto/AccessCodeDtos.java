package org.acme.dto;

import org.acme.dto.SurveyDtos.SurveyDto;

import jakarta.validation.constraints.NotBlank;

public final class AccessCodeDtos {

    private AccessCodeDtos() {}

    public record AccessCodeDto(
        String code,
        boolean requireCode,
        String lastRotatedAt
    ) {}

    public record UpdateAccessCodeRequest(boolean requireCode) {}

    public record EnterCodeRequest(@NotBlank String code) {}

    public record ResolvedAccess(SurveyDto survey, String accessToken) {}
}
