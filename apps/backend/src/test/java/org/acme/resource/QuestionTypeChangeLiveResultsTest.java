package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.acme.entity.Question;
import org.acme.entity.SurveyResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;

@QuarkusTest
class QuestionTypeChangeLiveResultsTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    @InjectMock
    ResultsRelay relay;

    private static String create() {
        return given().contentType(ContentType.JSON).body("{\"title\":\"Type change\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
    }

    private static void save(String id, String settings, String question) {
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Type change\",\"status\":\"published\",\"settings\":" + settings
                + ",\"questions\":[" + question + "]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
    }

    private static String submit(String id, String questionId, String value) {
        return given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + questionId + "\",\"value\":" + value + "}]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201).extract().path("data.editToken");
    }

    private static void graceElapsed(String surveyId, String questionId) {
        QuarkusTransaction.requiringNew().run(() -> {
            Question question = Question.findById(questionId);
            Instant changed = question.typeChangedAt;
            if (changed == null) return;
            question.typeChangedAt = changed.minus(2, ChronoUnit.MINUTES);
            SurveyResponse.<SurveyResponse>list("surveyId = ?1 and submittedAt < ?2", surveyId, changed)
                .forEach(r -> r.submittedAt = r.submittedAt.minus(2, ChronoUnit.MINUTES));
        });
    }

    private static String openRun(String id) {
        String body = "{\"label\":\"Open\",\"opensAt\":\"" + Instant.now().minus(1, ChronoUnit.HOURS)
            + "\",\"closesAt\":\"" + Instant.now().plus(1, ChronoUnit.HOURS) + "\"}";
        return given().contentType(ContentType.JSON).body(body)
            .when().post(SURVEYS + "/" + id + "/runs").then().statusCode(201).extract().path("data.id");
    }

    @Test
    @TestSecurity(user = "owner-1")
    void typeChangeHidesEarlierAnswersFromPublicLiveResultsOnly() {
        String id = create();
        String k = id.substring(0, 8);
        String q = "q-" + k;
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Secret\",\"required\":false,\"order\":0}");
        submit(id, q, "\"banana-" + k + "\"");

        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"dropdown\",\"title\":\"Secret\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"banana-" + k + "\",\"label\":\"Banana\"},{\"id\":\"apple-" + k + "\",\"label\":\"Apple\"}]}");
        graceElapsed(id, q);
        submit(id, q, "\"apple-" + k + "\"");

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'banana-" + k + "'", is(0))
            .body("data.questions[0].optionCounts.'apple-" + k + "'", is(1));
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'banana-" + k + "'", is(1))
            .body("data.questions[0].optionCounts.'apple-" + k + "'", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void choiceTypeChangeHidesEarlierAnswersButKeepsLaterOnes() {
        String id = create();
        String k = id.substring(0, 8);
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        String question = "{\"id\":\"q-" + k + "\",\"type\":\"%s\",\"title\":\"Pick\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"a-" + k + "\",\"label\":\"A\"}]}";
        save(id, settings, question.formatted("multiple-choice"));
        submit(id, "q-" + k, "\"a-" + k + "\"");
        save(id, settings, question.formatted("dropdown"));
        save(id, settings, question.formatted("dropdown"));
        graceElapsed(id, "q-" + k);
        submit(id, "q-" + k, "\"a-" + k + "\"");

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.totalResponses", is(2))
            .body("data.questions[0].optionCounts.'a-" + k + "'", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void broadcastAfterTypeChangeCarriesOnlyTheNewSubmission() {
        String id = create();
        String q = "q-" + id.substring(0, 8);
        String settings = "{\"postSubmitCombinedWordcloud\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Secret\",\"required\":false,\"order\":0}");
        submit(id, q, "\"hidden words\"");
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"wordcloud\",\"title\":\"Cloud\",\"required\":false,\"order\":0}");
        graceElapsed(id, q);
        org.mockito.Mockito.clearInvocations(relay);
        submit(id, q, "[\"sun\"]");

        var message = ArgumentCaptor.forClass(String.class);
        verify(relay, timeout(5000)).broadcast(eq(id), message.capture());
        assertThat(message.getValue(), containsString("\"sun\""));
        assertThat(message.getValue(), not(containsString("hidden")));
        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.sun", is(1))
            .body("data.questions[0].optionCounts.size()", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void runLiveResultsKeepAnswersWhenTheMasterTypeChangesAfterTheSnapshot() {
        String id = create();
        String k = id.substring(0, 8);
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        String question = "{\"id\":\"q-" + k + "\",\"type\":\"%s\",\"title\":\"Pick\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"a-" + k + "\",\"label\":\"A\"}]}";
        save(id, settings, question.formatted("multiple-choice"));
        openRun(id);
        submit(id, "q-" + k, "\"a-" + k + "\"");
        save(id, settings, question.formatted("dropdown"));

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].type", is("multiple-choice"))
            .body("data.questions[0].optionCounts.'a-" + k + "'", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void runLiveResultsHideMovedAnswersFromBeforeATypeChangeTheSnapshotHas() {
        String id = create();
        String k = id.substring(0, 8);
        String q = "q-" + k;
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Secret\",\"required\":false,\"order\":0}");
        submit(id, q, "\"banana-" + k + "\"");
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"dropdown\",\"title\":\"Secret\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"banana-" + k + "\",\"label\":\"Banana\"}]}");
        String runId = openRun(id);
        QuarkusTransaction.requiringNew().run(() -> SurveyResponse.update("sessionId = ?1 where surveyId = ?2", runId, id));

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].type", is("dropdown"))
            .body("data.questions[0].optionCounts.'banana-" + k + "'", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void publicResultsSkipValuesOfTheOldTypeSubmittedAcrossTheChange() {
        String id = create();
        String q = "q-" + id.substring(0, 8);
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"slider\",\"title\":\"Level\",\"required\":false,\"order\":0}");
        submit(id, q, "50");
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"rating\",\"title\":\"Level\",\"required\":false,\"order\":0}");
        QuarkusTransaction.requiringNew().run(() ->
            Question.update("typeChangedAt = ?1 where id = ?2", Instant.now().minus(1, ChronoUnit.HOURS), q));
        submit(id, q, "4");

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'4'", is(1))
            .body("data.questions[0].optionCounts.size()", is(1));
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'50'", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void answersEditedAfterTheTypeChangeCount() {
        String id = create();
        String k = id.substring(0, 8);
        String q = "q-" + k;
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true,\"allowEditResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Pick\",\"required\":false,\"order\":0}");
        String token = submit(id, q, "\"banana-" + k + "\"");
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"dropdown\",\"title\":\"Pick\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"banana-" + k + "\",\"label\":\"Banana\"},{\"id\":\"apple-" + k + "\",\"label\":\"Apple\"}]}");
        graceElapsed(id, q);
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + q + "\",\"value\":\"apple-" + k + "\"}]}")
            .when().put("/api/v1/public/responses/" + token).then().statusCode(200);

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'apple-" + k + "'", is(1))
            .body("data.questions[0].optionCounts.'banana-" + k + "'", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void answersRightAfterATypeChangeStayOutOfPublicResultsForAMoment() {
        String id = create();
        String k = id.substring(0, 8);
        String q = "q-" + k;
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Secret\",\"required\":false,\"order\":0}");
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"dropdown\",\"title\":\"Secret\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"apple-" + k + "\",\"label\":\"Apple\"}]}");
        submit(id, q, "\"apple-" + k + "\"");

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'apple-" + k + "'", is(0));
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'apple-" + k + "'", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void readdingADeletedQuestionUnderItsIdKeepsItsOldAnswersPrivate() {
        String id = create();
        String k = id.substring(0, 8);
        String q = "q-" + k;
        String settings = "{\"showLiveResults\":true,\"allowMultipleResponses\":true}";
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"short-answer\",\"title\":\"Secret\",\"required\":false,\"order\":0}");
        submit(id, q, "\"banana-" + k + "\"");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Type change\",\"status\":\"published\",\"settings\":" + settings + ",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        save(id, settings, "{\"id\":\"" + q + "\",\"type\":\"dropdown\",\"title\":\"Secret\",\"required\":false,\"order\":0,"
            + "\"options\":[{\"id\":\"banana-" + k + "\",\"label\":\"Banana\"}]}");
        graceElapsed(id, q);

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions[0].optionCounts.'banana-" + k + "'", is(0));
    }
}
