package org.acme.entity;

import java.util.EnumSet;
import java.util.Set;

/** The account-level notification events a user can toggle per channel (#89 extended). */
public enum NotificationEventType {
    NEW_RESPONSE("new_response", NotificationChannel.ALL),
    DAILY_DIGEST("daily_digest", EnumSet.of(NotificationChannel.EMAIL)),
    COLLABORATOR_INVITED("collaborator_invited", NotificationChannel.ALL),
    COLLABORATOR_ACCEPTED("collaborator_accepted", NotificationChannel.ALL),
    COLLABORATOR_DECLINED("collaborator_declined", NotificationChannel.ALL),
    COLLABORATOR_REMOVED("collaborator_removed", NotificationChannel.ALL),
    RESPONSE_MILESTONE("response_milestone", NotificationChannel.ALL),
    SURVEY_AUTO_CLOSED("survey_auto_closed", NotificationChannel.ALL),
    WEBHOOK_FAILING("webhook_failing", NotificationChannel.ALL);

    private final String key;
    private final Set<NotificationChannel> validChannels;

    NotificationEventType(String key, Set<NotificationChannel> validChannels) {
        this.key = key;
        this.validChannels = validChannels;
    }

    public String key() {
        return key;
    }

    /** Channels this event can be toggled on. Daily digest is email-only. */
    public Set<NotificationChannel> validChannels() {
        return validChannels;
    }

    public static NotificationEventType fromKey(String key) {
        for (var t : values()) {
            if (t.key.equals(key)) return t;
        }
        throw new IllegalArgumentException("Unknown notification event type: " + key);
    }
}
