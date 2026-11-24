package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.notNullValue;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.mailer.MockMailbox;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(user = "owner-score-visibility")
class ScoreVisibilityTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String OUTCOMES =
        ",\"outcomes\":[{\"id\":\"low\",\"title\":\"Low\",\"maxScore\":0},"
            + "{\"id\":\"high\",\"title\":\"High\",\"minScore\":1}]";

    @Inject
    MockMailbox mailbox;

    @BeforeEach
    void setup() {
        mailbox.clear();
    }

    private static String quiz(String settings) {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Scores\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Scores\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,"
                + "\"allowMultipleResponses\":true,\"passingScore\":1,\"respondentReceipts\":true"
                + settings + "},\"questions\":[{\"id\":\"q-" + id.substring(0, 8) + "\",\"type\":\"short-answer\","
                + "\"title\":\"2+2?\",\"required\":false,\"order\":0,\"points\":2,"
                + "\"correctAnswers\":[\"4\"]}]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return id;
    }

    private static ValidatableResponse submit(String id, String email) {
        return given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"q-" + id.substring(0, 8) + "\",\"value\":\"4\"}],"
                + "\"respondentEmail\":\"" + email + "\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);
    }

    private String receipt(String email) {
        var mails = mailbox.getMailsSentTo(email);
        assertEquals(1, mails.size());
        return mails.get(0).getHtml();
    }

    private static String email() {
        return "student-" + UUID.randomUUID() + "@test.local";
    }

    @Test
    void unreleasedResultCodeHidesScoreAfterSubmit() {
        String email = email();
        submit(quiz(",\"studentResults\":true"), email)
            .body("data.score", nullValue())
            .body("data.maxScore", nullValue())
            .body("data.passed", nullValue())
            .body("data.grade", nullValue())
            .body("data.resultCode", notNullValue());
        submit(quiz(",\"studentResults\":true" + OUTCOMES), email())
            .body("data.outcomeId", nullValue());
        assertFalse(receipt(email).contains("2 / 2"));
    }

    @Test
    void releasedResultCodeShowsScoreAfterSubmit() {
        String email = email();
        submit(quiz(",\"studentResults\":true,\"resultsReleased\":true"), email)
            .body("data.score", is(2))
            .body("data.maxScore", is(2))
            .body("data.passed", is(true));
        assertTrue(receipt(email).contains("2 / 2"));
    }

    @Test
    void neverHidesScoreButStillPicksTheOutcome() {
        String email = email();
        submit(quiz(",\"showCorrectAnswers\":\"never\"" + OUTCOMES), email)
            .body("data.score", nullValue())
            .body("data.maxScore", nullValue())
            .body("data.passed", nullValue())
            .body("data.outcomeId", is("high"));
        assertFalse(receipt(email).contains("2 / 2"));
    }

    @Test
    void scoreOnlyStillShowsScoreAndOutcome() {
        String email = email();
        submit(quiz(",\"showCorrectAnswers\":\"after-submission\"" + OUTCOMES), email)
            .body("data.score", is(2))
            .body("data.passed", is(true))
            .body("data.outcomeId", is("high"));
        assertTrue(receipt(email).contains("2 / 2"));
    }

    @Test
    void outcomesSavedWithoutAnIdStillGetPicked() {
        submit(quiz(",\"showCorrectAnswers\":\"never\",\"outcomes\":[{\"title\":\"Any\",\"minScore\":0}]"), email())
            .body("data.score", nullValue())
            .body("data.outcomeId", notNullValue());
    }
}
