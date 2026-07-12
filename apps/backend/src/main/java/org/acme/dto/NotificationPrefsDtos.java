package org.acme.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** Account-level notification preferences (issue #89). */
public final class NotificationPrefsDtos {

    private NotificationPrefsDtos() {}

    /** Channels available for the "new response" event. */
    public record NewResponseChannels(boolean email, boolean mobilePush, boolean webPush) {}

    /** The daily digest is email-only. */
    public record DailyDigestChannels(boolean email) {}

    public record NotificationPrefsDto(
        NewResponseChannels newResponse,
        DailyDigestChannels dailyDigest
    ) {}

    public record NotificationPrefsRequest(
        @NotNull @Valid NewResponseChannels newResponse,
        @NotNull @Valid DailyDigestChannels dailyDigest
    ) {}
}
