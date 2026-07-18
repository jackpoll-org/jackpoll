package org.acme.dto;

import java.util.Map;

import jakarta.validation.constraints.NotNull;

/**
 * Account-level notification preferences (issue #89), covering every event
 * in {@link org.acme.entity.NotificationEventType} across every channel in
 * {@link org.acme.entity.NotificationChannel} valid for that event.
 *
 * <p>Shape is a matrix rather than one record per event — {@code byEvent} maps
 * event key (e.g. {@code "new_response"}) to a map of channel key (e.g.
 * {@code "email"}) to enabled/disabled. {@link org.acme.service.NotificationPrefsService}
 * validates keys and the digest-is-email-only rule server-side.
 */
public final class NotificationPrefsDtos {

    private NotificationPrefsDtos() {}

    public record NotificationPrefsDto(Map<String, Map<String, Boolean>> byEvent) {}

    public record NotificationPrefsRequest(@NotNull Map<String, Map<String, Boolean>> byEvent) {}
}
