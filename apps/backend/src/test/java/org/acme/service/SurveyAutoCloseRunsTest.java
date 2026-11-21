package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.acme.entity.LiveSession;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyResponse;
import org.acme.entity.SurveyStatus;
import org.acme.repository.LiveSessionRepository;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class SurveyAutoCloseRunsTest {

    @Inject
    SurveyAutoCloseService autoClose;

    @Inject
    SurveyRepository surveys;

    @Inject
    LiveSessionRepository runs;

    @Inject
    ResponseRepository responses;

    private String run(String surveyId, Instant opensAt) {
        var run = new LiveSession();
        run.id = UUID.randomUUID().toString();
        run.surveyId = surveyId;
        run.kind = LiveSession.SCHEDULED;
        run.label = "Backstop";
        run.opensAt = opensAt;
        run.startedAt = opensAt;
        run.closesAt = Instant.now().plus(2, ChronoUnit.HOURS);
        runs.persist(run);
        return run.id;
    }

    @Test
    void snapshotsOpenedRunsAndLeavesFutureOnesAndTheSurveyAlone() {
        String surveyId = UUID.randomUUID().toString();
        String[] ids = new String[2];
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = surveyId;
            survey.ownerId = "backstop-owner";
            survey.title = "Backstop";
            survey.status = SurveyStatus.PUBLISHED;
            survey.settings = SurveySettings.defaults();
            survey.settings.responseLimit = 1;
            survey.settings.closesAt = Instant.now().plus(2, ChronoUnit.DAYS).toString();
            surveys.persist(survey);
            ids[0] = run(surveyId, Instant.now().minus(1, ChronoUnit.HOURS));
            ids[1] = run(surveyId, Instant.now().plus(1, ChronoUnit.HOURS));
        });

        autoClose.closeExpiredSurveys();

        QuarkusTransaction.requiringNew().run(() -> {
            assertNotNull(runs.findById(ids[0]).snapshot);
            assertEquals("Backstop", runs.findById(ids[0]).snapshot.title());
            assertNull(runs.findById(ids[1]).snapshot);
            assertEquals(SurveyStatus.PUBLISHED, surveys.findById(surveyId).status);
        });
    }

    @Test
    void closesASurveyWithRunsAtItsOwnCloseTime() {
        String surveyId = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = surveyId;
            survey.ownerId = "backstop-owner";
            survey.title = "Outer bound";
            survey.status = SurveyStatus.PUBLISHED;
            survey.settings = SurveySettings.defaults();
            survey.settings.closesAt = "2000-01-01T00:00:00Z";
            surveys.persist(survey);
            run(surveyId, Instant.now().minus(1, ChronoUnit.HOURS));
        });

        autoClose.closeExpiredSurveys();

        QuarkusTransaction.requiringNew().run(() ->
            assertEquals(SurveyStatus.CLOSED, surveys.findById(surveyId).status));
    }

    @Test
    void backstopFreezesLateSessionlessResponsesWithoutASnapshot() {
        String withRuns = UUID.randomUUID().toString();
        String withoutRuns = UUID.randomUUID().toString();
        String[] ids = new String[2];
        QuarkusTransaction.requiringNew().run(() -> {
            for (var id : new String[] {withRuns, withoutRuns}) {
                var survey = new Survey();
                survey.id = id;
                survey.ownerId = "backstop-owner";
                survey.title = "Late";
                survey.status = SurveyStatus.PUBLISHED;
                survey.settings = SurveySettings.defaults();
                surveys.persist(survey);
            }
            run(withRuns, Instant.now().plus(1, ChronoUnit.HOURS));
            ids[0] = response(withRuns);
            ids[1] = response(withoutRuns);
        });

        autoClose.closeExpiredSurveys();

        QuarkusTransaction.requiringNew().run(() -> {
            var frozen = runs.findById(responses.findById(ids[0]).sessionId);
            assertNotNull(frozen.closedAt);
            assertNull(frozen.snapshot);
            assertNull(responses.findById(ids[1]).sessionId);
        });
    }

    private String response(String surveyId) {
        var response = new SurveyResponse();
        response.id = UUID.randomUUID().toString();
        response.surveyId = surveyId;
        response.submittedAt = Instant.now();
        responses.persist(response);
        return response.id;
    }
}
