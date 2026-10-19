package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.acme.entity.Question;
import org.acme.entity.QuestionType;
import org.acme.entity.ResponseAnswer;
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

    @Test
    void anonymiseDropsNameAndIdentifyingAnswers() {
        var survey = newSurvey(30, true);
        var text = new Question();
        text.id = UUID.randomUUID().toString();
        text.type = QuestionType.SHORT_ANSWER;
        text.title = "Your name?";
        var rating = new Question();
        rating.id = UUID.randomUUID().toString();
        rating.type = QuestionType.RATING;
        rating.title = "Rate us";
        String responseId = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var s = surveys.findById(survey.id);
            text.survey = s;
            rating.survey = s;
            s.questions.add(text);
            s.questions.add(rating);
            var r = new SurveyResponse();
            r.id = responseId;
            r.surveyId = survey.id;
            r.submittedAt = Instant.now().minus(60, ChronoUnit.DAYS);
            r.respondentName = "Ada";
            r.answers.add(answer(r, text.id, "Ada Lovelace"));
            r.answers.add(answer(r, rating.id, 5));
            responseRepo.persist(r);
        });

        QuarkusTransaction.requiringNew().run(() -> responses.applyRetention(survey, 30, true));

        QuarkusTransaction.requiringNew().run(() -> {
            var kept = responseRepo.findById(responseId);
            assertNull(kept.respondentName);
            assertEquals(1, kept.answers.size());
            assertEquals(rating.id, kept.answers.get(0).questionId);
        });
    }

    private static ResponseAnswer answer(SurveyResponse r, String questionId, Object value) {
        var a = new ResponseAnswer();
        a.id = UUID.randomUUID().toString();
        a.response = r;
        a.questionId = questionId;
        a.value = value;
        return a;
    }

    @Inject
    RetentionService retention;

    @Inject
    org.acme.repository.ResponseDraftRepository drafts;

    @Inject
    org.acme.repository.NotificationRepository notifications;

    @Test
    void purgesExpiredDraftsAndOldNotifications() {
        var draft = new org.acme.entity.ResponseDraft();
        draft.id = UUID.randomUUID().toString();
        draft.token = UUID.randomUUID().toString();
        draft.surveyId = UUID.randomUUID().toString();
        draft.answers = java.util.Map.of();
        draft.createdAt = Instant.now().minus(31, ChronoUnit.DAYS);
        draft.updatedAt = draft.createdAt;
        draft.expiresAt = Instant.now().minus(1, ChronoUnit.DAYS);
        var old = new org.acme.entity.Notification();
        old.id = UUID.randomUUID().toString();
        old.userId = UUID.randomUUID().toString();
        old.eventType = "new_response";
        old.title = "Old";
        old.body = "Old";
        old.createdAt = Instant.now().minus(91, ChronoUnit.DAYS);
        QuarkusTransaction.requiringNew().run(() -> {
            drafts.persist(draft);
            notifications.persist(old);
        });

        retention.purgeStale();

        assertEquals(0, drafts.count("id", draft.id), "expired draft purged");
        assertEquals(0, notifications.count("id", old.id), "old notification purged");
    }
}
