package org.acme.service;

import org.acme.dto.NotificationPrefsDtos.DailyDigestChannels;
import org.acme.dto.NotificationPrefsDtos.NewResponseChannels;
import org.acme.dto.NotificationPrefsDtos.NotificationPrefsDto;
import org.acme.dto.NotificationPrefsDtos.NotificationPrefsRequest;
import org.acme.entity.User;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.UserRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Account-level notification preferences (issue #89). */
@ApplicationScoped
public class NotificationPrefsService {

    @Inject
    UserRepository users;

    /** Defaults (all channels on) for an authenticated user without a row yet. */
    private static final NotificationPrefsDto DEFAULTS = new NotificationPrefsDto(
        new NewResponseChannels(true, true, true),
        new DailyDigestChannels(true));

    public NotificationPrefsDto get(String ownerId) {
        return users.findByIdOptional(ownerId).map(this::toDto).orElse(DEFAULTS);
    }

    @Transactional
    public NotificationPrefsDto update(String ownerId, NotificationPrefsRequest req) {
        User u = findOrThrow(ownerId);
        u.notifyNewResponseEmail = req.newResponse().email();
        u.notifyNewResponseMobile = req.newResponse().mobilePush();
        u.notifyNewResponseWeb = req.newResponse().webPush();
        u.notifyDailyDigestEmail = req.dailyDigest().email();
        return toDto(u);
    }

    private User findOrThrow(String ownerId) {
        return users.findByIdOptional(ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + ownerId));
    }

    private NotificationPrefsDto toDto(User u) {
        return new NotificationPrefsDto(
            new NewResponseChannels(
                u.notifyNewResponseEmail, u.notifyNewResponseMobile, u.notifyNewResponseWeb),
            new DailyDigestChannels(u.notifyDailyDigestEmail));
    }
}
