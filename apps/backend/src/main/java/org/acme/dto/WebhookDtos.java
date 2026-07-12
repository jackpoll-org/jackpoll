package org.acme.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** DTOs for survey webhooks (issue #36). */
public final class WebhookDtos {

    private WebhookDtos() {}

    public record CreateWebhookRequest(
        @NotBlank
        @Size(max = 2048)
        @Pattern(regexp = "^https?://.+", message = "URL must start with http:// or https://")
        String url,
        boolean enabled
    ) {}

    /** Owner-facing webhook view. The signing secret is included so the owner
     *  can configure their receiver to verify signatures. */
    public record WebhookDto(
        String id,
        String url,
        boolean enabled,
        String secret,
        Integer lastStatus,
        String lastError,
        String lastDeliveryAt,
        String createdAt
    ) {}

    /** Result of a manual "send test event". */
    public record WebhookTestResult(
        boolean delivered,
        Integer status,
        String error
    ) {}
}
