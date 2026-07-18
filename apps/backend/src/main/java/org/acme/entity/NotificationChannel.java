package org.acme.entity;

import java.util.EnumSet;
import java.util.Set;

/** A delivery channel for account-level notifications (#89 extended). */
public enum NotificationChannel {
    EMAIL("email"),
    MOBILE_PUSH("mobile_push"),
    WEB_PUSH("web_push"),
    IN_APP("in_app");

    public static final Set<NotificationChannel> ALL = EnumSet.allOf(NotificationChannel.class);

    private final String key;

    NotificationChannel(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    public static NotificationChannel fromKey(String key) {
        for (var c : values()) {
            if (c.key.equals(key)) return c;
        }
        throw new IllegalArgumentException("Unknown notification channel: " + key);
    }
}
