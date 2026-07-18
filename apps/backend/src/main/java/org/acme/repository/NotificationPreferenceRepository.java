package org.acme.repository;

import java.util.List;

import org.acme.entity.NotificationPreference;
import org.acme.entity.NotificationPreferenceId;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

/**
 * Per-user (event, channel) notification preference overrides (#89). Only
 * disabled cells are ever stored — a missing row means "enabled".
 */
@ApplicationScoped
public class NotificationPreferenceRepository
        implements PanacheRepositoryBase<NotificationPreference, NotificationPreferenceId> {

    /** All stored overrides for a user — callers default any missing cell to enabled. */
    public List<NotificationPreference> findAllForUser(String userId) {
        return find("userId", userId).list();
    }

    /** Whether a single (event, channel) cell is enabled, defaulting to true when unset. */
    public boolean isEnabled(String userId, String eventType, String channel) {
        var pref = findById(new NotificationPreferenceId(userId, eventType, channel));
        return pref == null || pref.enabled;
    }

    @Transactional
    public void upsert(String userId, String eventType, String channel, boolean enabled) {
        var id = new NotificationPreferenceId(userId, eventType, channel);
        var pref = findById(id);
        if (pref == null) {
            pref = new NotificationPreference();
            pref.userId = userId;
            pref.eventType = eventType;
            pref.channel = channel;
        }
        pref.enabled = enabled;
        persist(pref);
    }

    @Transactional
    public void deleteAllForUser(String userId) {
        delete("userId", userId);
    }
}
