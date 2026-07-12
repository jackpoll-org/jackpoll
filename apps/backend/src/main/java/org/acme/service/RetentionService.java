package org.acme.service;

import org.acme.entity.Survey;
import org.acme.repository.SurveyRepository;
import org.jboss.logging.Logger;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Data-retention enforcement (issue #64, GDPR Art. 5(1)(e) storage limitation).
 * A daily job purges or anonymises survey responses older than each survey's
 * configured retention window. Surveys without a retention period are untouched.
 */
@ApplicationScoped
public class RetentionService {

    private static final Logger LOG = Logger.getLogger(RetentionService.class);

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseService responses;

    /** Runs daily at 03:30 (override via {@code survey.retention.cron}). */
    @Scheduled(cron = "{survey.retention.cron:0 30 3 * * ?}")
    void enforceRetention() {
        int totalSurveys = 0;
        int totalAffected = 0;
        for (Survey survey : surveys.listAll()) {
            var settings = survey.settings;
            if (settings == null || settings.retentionDays == null || settings.retentionDays <= 0) {
                continue;
            }
            try {
                int affected = responses.applyRetention(
                    survey, settings.retentionDays, settings.retentionAnonymize);
                if (affected > 0) {
                    totalSurveys++;
                    totalAffected += affected;
                }
            } catch (Exception e) {
                // One survey failing must not stop the rest.
                LOG.warnf(e, "retention failed for survey %s", survey.id);
            }
        }
        if (totalAffected > 0) {
            LOG.infof("retention: processed %d responses across %d surveys",
                totalAffected, totalSurveys);
        }
    }
}
