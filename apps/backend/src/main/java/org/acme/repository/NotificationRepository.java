package org.acme.repository;

import java.time.Instant;
import java.util.List;

import org.acme.entity.Notification;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

/** The in-app notification center's storage (#89). */
@ApplicationScoped
public class NotificationRepository implements PanacheRepositoryBase<Notification, String> {

    public List<Notification> findByUser(String userId, int page, int limit) {
        return find("userId", Sort.by("createdAt").descending(), userId)
            .page(Page.of(page, limit))
            .list();
    }

    public long countByUser(String userId) {
        return count("userId", userId);
    }

    public long countUnread(String userId) {
        return count("userId = ?1 and readAt is null", userId);
    }

    @Transactional
    public boolean markRead(String userId, String notificationId) {
        var n = find("id = ?1 and userId = ?2", notificationId, userId).firstResult();
        if (n == null) return false;
        if (n.readAt == null) n.readAt = Instant.now();
        return true;
    }

    @Transactional
    public int markAllRead(String userId) {
        return update("readAt = ?1 where userId = ?2 and readAt is null", Instant.now(), userId);
    }

    @Transactional
    public void deleteAllForUser(String userId) {
        delete("userId", userId);
    }
}
