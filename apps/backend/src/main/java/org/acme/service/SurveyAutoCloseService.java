package org.acme.service;

import java.time.Instant;

import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.acme.repository.NotificationPreferenceRepository;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Detects when a published survey has passed its scheduled close time or hit
 * its response limit (previously only checked live, on each submit/read, in
 * {@link SurveyAvailability}) and flips it to {@link SurveyStatus#CLOSED},
 * firing the "survey auto-closed" notification (#89) at that transition.
 */
@ApplicationScoped
public class SurveyAutoCloseService {

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseRepository responses;

    @Inject
    UserRepository users;

    @Inject
    PushService pushService;

    @Inject
    EmailService emailService;

    @Inject
    NotificationRecordService notificationRecordService;

    @Inject
    NotificationPreferenceRepository notificationPrefs;

    @Scheduled(every = "5m")
    @Transactional
    void closeExpiredSurveys() {
        for (Survey survey : surveys.list("status", SurveyStatus.PUBLISHED)) {
            if (isPastAvailability(survey)) {
                survey.status = SurveyStatus.CLOSED;
                notifyAutoClosed(survey);
            }
        }
    }

    private boolean isPastAvailability(Survey survey) {
        var settings = survey.settings;
        if (settings == null) return false;
        if (settings.closesAt != null && !settings.closesAt.isBlank()) {
            try {
                if (Instant.now().isAfter(Instant.parse(settings.closesAt))) return true;
            } catch (java.time.format.DateTimeParseException ignored) {
                // malformed → no date limit
            }
        }
        if (settings.responseLimit != null && settings.responseLimit > 0) {
            long count = responses.countBySurvey(survey.id);
            if (count >= settings.responseLimit) return true;
        }
        return false;
    }

    private void notifyAutoClosed(Survey survey) {
        var type = NotificationEventType.SURVEY_AUTO_CLOSED;
        String title = "Survey closed";
        String body = "\"" + survey.title + "\" has automatically closed.";
        pushService.notifyUser(survey.ownerId, type, title, body);
        notificationRecordService.record(survey.ownerId, type, title, body,
            "/surveys/" + survey.id + "/results");
        if (notificationPrefs.isEnabled(survey.ownerId, type.key(), NotificationChannel.EMAIL.key())) {
            users.findByIdOptional(survey.ownerId)
                .ifPresent(owner -> emailService.sendSurveyAutoClosed(owner.email, survey.title));
        }
    }
}
