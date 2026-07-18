package org.acme.dto;

import java.time.Instant;

/** The in-app notification center's list/unread-count payloads (issue #89). */
public final class NotificationDtos {

    private NotificationDtos() {}

    public record NotificationDto(
        String id,
        String eventType,
        String title,
        String body,
        String link,
        boolean read,
        Instant createdAt
    ) {}

    public record UnreadCountDto(long count) {}
}
