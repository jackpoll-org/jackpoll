package org.acme.service;

import java.util.List;

import org.acme.dto.NotificationDtos.NotificationDto;
import org.acme.entity.Notification;
import org.acme.repository.NotificationRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** The in-app notification center's read/mark-read operations (#89). */
@ApplicationScoped
public class NotificationsService {

    @Inject
    NotificationRepository notifications;

    public record Page(List<NotificationDto> items, long total) {}

    public Page list(String userId, int page, int limit) {
        var items = notifications.findByUser(userId, page, limit).stream()
            .map(this::toDto)
            .toList();
        return new Page(items, notifications.countByUser(userId));
    }

    public long unreadCount(String userId) {
        return notifications.countUnread(userId);
    }

    public boolean markRead(String userId, String id) {
        return notifications.markRead(userId, id);
    }

    public void markAllRead(String userId) {
        notifications.markAllRead(userId);
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(
            n.id, n.eventType, n.title, n.body, n.link, n.readAt != null, n.createdAt);
    }
}
