package org.acme.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Custom-template DTOs (issue #20). {@code questions}/{@code settings} are
 * passed through as JSON matching the frontend types.
 */
public final class TemplateDtos {

    private TemplateDtos() {}

    public record CreateTemplateRequest(
        @NotBlank @Size(max = 255) String name,
        String description,
        Object questions,
        Object settings
    ) {}

    public record UpdateTemplateRequest(
        @NotBlank @Size(max = 255) String name,
        String description
    ) {}

    public record TemplateDto(
        String id,
        String name,
        String description,
        Object questions,
        Object settings,
        String updatedAt
    ) {}
}
