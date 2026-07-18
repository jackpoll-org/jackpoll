package org.acme.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite key for {@link NotificationPreference}: (user, event, channel). */
public class NotificationPreferenceId implements Serializable {

    public String userId;
    public String eventType;
    public String channel;

    public NotificationPreferenceId() {}

    public NotificationPreferenceId(String userId, String eventType, String channel) {
        this.userId = userId;
        this.eventType = eventType;
        this.channel = channel;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NotificationPreferenceId that)) return false;
        return Objects.equals(userId, that.userId)
            && Objects.equals(eventType, that.eventType)
            && Objects.equals(channel, that.channel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, eventType, channel);
    }
}
