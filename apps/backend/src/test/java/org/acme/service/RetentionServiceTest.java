package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.acme.entity.Survey;
import org.acme.entity.SurveyResponse;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

/** Data-retention purge/anonymise tests (issue #64). */
@QuarkusTest
class RetentionServiceTest {

    @Inject
    ResponseService responses;

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseRepository responseRepo;

    private Survey newSurvey(int retentionDays, boolean anonymize) {
        var survey = new Survey();
        survey.id = UUID.randomUUID().toString();
        survey.ownerId = UUID.randomUUID().toString();
        survey.title = "Retention";
        survey.status = SurveyStatus.PUBLISHED;
        survey.settings = SurveySettings.defaults();
        survey.settings.retentionDays = retentionDays;
        survey.settings.retentionAnonymize = anonymize;
        QuarkusTransaction.requiringNew().run(() -> surveys.persist(survey));
        return survey;
    }

    private String addResponse(String surveyId, Instant submittedAt, String clientId) {
        String id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var r = new SurveyResponse();
            r.id = id;
            r.surveyId = surveyId;
            r.submittedAt = submittedAt;
            r.clientId = clientId;
            responseRepo.persist(r);
        });
        return id;
    }

    @Test
    void deletesResponsesOlderThanRetention() {
        var survey = newSurvey(30, false);
        Instant now = Instant.now();
        String oldId = addResponse(survey.id, now.minus(60, ChronoUnit.DAYS), "cid-old");
        String freshId = addResponse(survey.id, now.minus(1, ChronoUnit.DAYS), "cid-new");

        int affected = responses.applyRetention(survey, 30, false);

        assertEquals(1, affected);
        assertTrue(responseRepo.findByIdOptional(oldId).isEmpty(), "old response deleted");
        assertTrue(responseRepo.findByIdOptional(freshId).isPresent(), "recent response kept");
    }

    @Test
    void anonymisesInsteadOfDeletingWhenEnabled() {
        var survey = newSurvey(30, true);
        Instant now = Instant.now();
        String oldId = addResponse(survey.id, now.minus(60, ChronoUnit.DAYS), "cid-old");

        int affected = responses.applyRetention(survey, 30, true);

        assertEquals(1, affected);
        var kept = responseRepo.findByIdOptional(oldId).orElseThrow();
        assertNull(kept.clientId, "client id cleared on anonymise");
    }
}
