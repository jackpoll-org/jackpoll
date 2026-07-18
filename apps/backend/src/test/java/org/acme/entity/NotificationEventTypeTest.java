package org.acme.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.Test;

class NotificationEventTypeTest {

    @Test
    void dailyDigestIsEmailOnly() {
        assertEquals(Set.of(NotificationChannel.EMAIL), NotificationEventType.DAILY_DIGEST.validChannels());
        assertFalse(NotificationEventType.DAILY_DIGEST.validChannels().contains(NotificationChannel.IN_APP));
    }

    @Test
    void everyOtherEventSupportsAllFourChannels() {
        for (var type : NotificationEventType.values()) {
            if (type == NotificationEventType.DAILY_DIGEST) continue;
            assertEquals(NotificationChannel.ALL, type.validChannels(), type + " should support all channels");
        }
    }

    @Test
    void fromKeyRoundTripsForEveryEvent() {
        for (var type : NotificationEventType.values()) {
            assertEquals(type, NotificationEventType.fromKey(type.key()));
        }
    }

    @Test
    void fromKeyRejectsUnknownEvent() {
        assertThrows(IllegalArgumentException.class, () -> NotificationEventType.fromKey("not_a_real_event"));
    }

    @Test
    void collaboratorInvitedIsDistinctFromNewResponse() {
        // Direct guard for issue #89's original bug: the two events must never
        // collapse to the same key again.
        assertTrue(!NotificationEventType.NEW_RESPONSE.key()
            .equals(NotificationEventType.COLLABORATOR_INVITED.key()));
    }
}
