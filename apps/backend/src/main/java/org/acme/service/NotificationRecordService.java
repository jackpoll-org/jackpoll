package org.acme.service;

import java.util.UUID;

import org.acme.entity.Notification;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.repository.NotificationPreferenceRepository;
import org.acme.repository.NotificationRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Writes in-app notification records (the "in_app" channel, issue #89).
 * Single responsibility: gate on the user's in-app preference for the event
 * and persist a row — doesn't know how to send push or email.
 */
@ApplicationScoped
public class NotificationRecordService {

    @Inject
    NotificationPreferenceRepository preferences;

    @Inject
    NotificationRepository notifications;

    @Transactional
    public void record(String userId, NotificationEventType type, String title, String body, String link) {
        if (!type.validChannels().contains(NotificationChannel.IN_APP)) return;
        if (!preferences.isEnabled(userId, type.key(), NotificationChannel.IN_APP.key())) return;

        var n = new Notification();
        n.id = UUID.randomUUID().toString();
        n.userId = userId;
        n.eventType = type.key();
        n.title = title;
        n.body = body;
        n.link = link;
        notifications.persist(n);
    }
}
