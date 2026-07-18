package org.acme.service;

import java.util.LinkedHashMap;
import java.util.Map;

import org.acme.dto.NotificationPrefsDtos.NotificationPrefsDto;
import org.acme.dto.NotificationPrefsDtos.NotificationPrefsRequest;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.repository.NotificationPreferenceRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Account-level notification preferences (issue #89): a matrix of every
 * {@link NotificationEventType} against every {@link NotificationChannel}
 * valid for it. A missing cell defaults to enabled.
 */
@ApplicationScoped
public class NotificationPrefsService {

    @Inject
    NotificationPreferenceRepository prefs;

    public NotificationPrefsDto get(String userId) {
        var overrides = prefs.findAllForUser(userId);
        var byEvent = new LinkedHashMap<String, Map<String, Boolean>>();
        for (var event : NotificationEventType.values()) {
            var channels = new LinkedHashMap<String, Boolean>();
            for (var channel : event.validChannels()) {
                channels.put(channel.key(), true);
            }
            byEvent.put(event.key(), channels);
        }
        for (var o : overrides) {
            var channels = byEvent.get(o.eventType);
            if (channels != null && channels.containsKey(o.channel)) {
                channels.put(o.channel, o.enabled);
            }
        }
        return new NotificationPrefsDto(byEvent);
    }

    @Transactional
    public NotificationPrefsDto update(String userId, NotificationPrefsRequest req) {
        for (var eventEntry : req.byEvent().entrySet()) {
            var event = NotificationEventType.fromKey(eventEntry.getKey());
            for (var channelEntry : eventEntry.getValue().entrySet()) {
                var channel = NotificationChannel.fromKey(channelEntry.getKey());
                if (!event.validChannels().contains(channel)) {
                    throw new IllegalArgumentException(
                        "Channel " + channel.key() + " is not valid for event " + event.key());
                }
                prefs.upsert(userId, event.key(), channel.key(), channelEntry.getValue());
            }
        }
        return get(userId);
    }
}
