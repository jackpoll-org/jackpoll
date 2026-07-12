package org.acme.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DTOs for push-notification device registration (mobile app). */
public final class DeviceDtos {

    private DeviceDtos() {}

    public record RegisterDeviceRequest(
        @NotBlank @Size(max = 512) String token,
        @Size(max = 16) String platform,
        // Web Push (#74) only — the browser subscription's encryption keys.
        // Null/absent for native FCM/APNs tokens.
        @Size(max = 255) String p256dh,
        @Size(max = 255) String auth
    ) {}
}
