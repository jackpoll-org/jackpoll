package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;

/**
 * Live quiz sessions: every "start game" opens a session, live answers are
 * tagged with the session running when they arrive, and results/responses can
 * be narrowed to one session — so a restarted quiz no longer shows the
 * previous game's players and scores.
 */
@QuarkusTest
class LiveSessionTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private String[] createQuiz(boolean liveMode) {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Quiz\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String qId = given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Quiz", "status": "published",
                  "settings": {"isQuiz": true, "liveMode": %s, "allowMultipleResponses": true},
                  "questions": [{"type":"short-answer","title":"Q","required":false,"order":0}]
                }
                """.formatted(liveMode))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");
        return new String[] {id, qId};
    }

    private String startSession(String surveyId) {
        return given().when().post(SURVEYS + "/" + surveyId + "/live/sessions")
            .then().statusCode(200)
            .body("data.startedAt", notNullValue())
            .extract().path("data.id");
    }

    private void answer(String[] quiz, String name) {
        answer(quiz, name, name);
    }

    private void answer(String[] quiz, String name, String clientId) {
        given().contentType(ContentType.JSON)
            .body("{\"respondentName\":\"" + name + "\",\"clientId\":\"" + clientId
                + "\",\"answers\":[{\"questionId\":\"" + quiz[1] + "\",\"value\":\"x\"}]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(201);
    }

    @Test
    @TestSecurity(user = "owner-sessions")
    void resultsAndResponsesCanBeNarrowedToOneSession() {
        var quiz = createQuiz(true);

        String first = startSession(quiz[0]);
        answer(quiz, "Ada");
        answer(quiz, "Bob");

        String second = startSession(quiz[0]);
        answer(quiz, "Cy");

        given().when().get(SURVEYS + "/" + quiz[0] + "/results?session=" + second)
            .then().statusCode(200).body("data.totalResponses", equalTo(1));
        given().when().get(SURVEYS + "/" + quiz[0] + "/results?session=" + first)
            .then().statusCode(200).body("data.totalResponses", equalTo(2));
        given().when().get(SURVEYS + "/" + quiz[0] + "/results")
            .then().statusCode(200).body("data.totalResponses", equalTo(3));

        given().when().get(SURVEYS + "/" + quiz[0] + "/responses?session=" + second)
            .then().statusCode(200)
            .body("data", hasSize(1))
            .body("data[0].respondentName", equalTo("Cy"));
    }

    @Test
    @TestSecurity(user = "owner-session-list")
    void listsSessionsNewestFirstWithPlayersAndAnswers() {
        var quiz = createQuiz(true);

        String first = startSession(quiz[0]);
        answer(quiz, "Ada");
        answer(quiz, "Ada", "Ada-tablet");
        answer(quiz, "Bob");
        String second = startSession(quiz[0]);

        given().when().get(SURVEYS + "/" + quiz[0] + "/live/sessions")
            .then().statusCode(200)
            .body("data", hasSize(2))
            .body("data[0].id", equalTo(second))
            .body("data[0].responses", equalTo(0))
            .body("data[1].id", equalTo(first))
            .body("data[1].players", equalTo(2))
            .body("data[1].responses", equalTo(3));
    }

    @Test
    @TestSecurity(user = "owner-not-live")
    void answersOutsideLiveModeBelongToNoSession() {
        var quiz = createQuiz(false);
        startSession(quiz[0]);
        answer(quiz, "Ada");

        given().when().get(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(200).body("data[0].sessionId", nullValue());
    }

    @Test
    @TestSecurity(user = "owner-clear-sessions")
    void clearingResponsesAlsoClearsTheSessions() {
        var quiz = createQuiz(true);
        startSession(quiz[0]);
        answer(quiz, "Ada");

        given().when().delete(SURVEYS + "/" + quiz[0] + "/responses").then().statusCode(200);

        given().when().get(SURVEYS + "/" + quiz[0] + "/live/sessions")
            .then().statusCode(200).body("data", hasSize(0));
    }

    /** A live quiz with one multiple-choice question worth 100 points; returns
     *  [surveyId, questionId, correctOptionId, wrongOptionId]. */
    private String[] createScoredQuiz() {
        return createScoredQuiz("");
    }

    private String[] createScoredQuiz(String extraSettings) {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Scored\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Scored", "status": "published",
                  "settings": {"isQuiz": true, "liveMode": true, "allowMultipleResponses": true%2$s},
                  "questions": [{"id":"q-%1$s","type":"multiple-choice","title":"Q","required":false,
                    "order":0,"points":100,"correctAnswers":["ok-%1$s"],
                    "options":[{"id":"ok-%1$s","label":"Right"},{"id":"no-%1$s","label":"Wrong"}]}]
                }
                """.formatted(p, extraSettings))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return new String[] {id, "q-" + p, "ok-" + p, "no-" + p};
    }

    private int pick(String[] quiz, String name, String optionId) {
        return given().contentType(ContentType.JSON)
            .body("{\"respondentName\":\"" + name + "\",\"clientId\":\"" + name
                + "\",\"answers\":[{\"questionId\":\"" + quiz[1] + "\",\"value\":\"" + optionId + "\"}]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().extract().statusCode();
    }

    @Test
    @TestSecurity(user = "owner-leaderboard")
    void leaderboardRanksOnlyTheCurrentSession() {
        var quiz = createScoredQuiz();

        startSession(quiz[0]);
        assertEquals(201, pick(quiz, "OldChamp", quiz[2]));

        startSession(quiz[0]);
        assertEquals(201, pick(quiz, "Ada", quiz[2]));
        assertEquals(400, pick(quiz, "Ada", quiz[2]));
        assertEquals(201, pick(quiz, "Bob", quiz[3]));
        assertEquals(201, pick(quiz, "Cy", quiz[2]));

        given().when().get(SURVEYS + "/" + quiz[0] + "/live/leaderboard")
            .then().statusCode(200)
            .body("data", hasSize(3))
            .body("data[0].name", equalTo("Ada"))
            .body("data[0].score", equalTo(100))
            .body("data[1].name", equalTo("Cy"))
            .body("data[2].name", equalTo("Bob"))
            .body("data[2].score", equalTo(0));

        given().when().get(SURVEYS + "/" + quiz[0] + "/live/leaderboard?limit=1")
            .then().statusCode(200).body("data", hasSize(1));
    }

    /** Players see the final leaderboard on their phones without an account. */
    @Test
    void leaderboardIsReadableWithoutSignIn() {
        given().when().get(SURVEYS + "/unknown/live/leaderboard")
            .then().statusCode(200).body("data", hasSize(0));
    }

    @Test
    void startingASessionRequiresSignIn() {
        given().when().post(SURVEYS + "/x/live/sessions").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "stranger")
    void cannotStartASessionOnSomeoneElsesSurvey() {
        given().when().post(SURVEYS + "/not-mine/live/sessions").then().statusCode(404);
        given().when().get(SURVEYS + "/not-mine/live/sessions").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-speed")
    void speedBonusIgnoresTheClientsOwnTiming() {
        var quiz = createScoredQuiz(", \"liveQuestionSeconds\": 20");
        startSession(quiz[0]);

        int score = given().contentType(ContentType.JSON)
            .body("{\"respondentName\":\"Fast\",\"clientId\":\"fast\",\"durationMs\":0,"
                + "\"answers\":[{\"questionId\":\"" + quiz[1] + "\",\"value\":\"" + quiz[2] + "\"}]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(201).extract().path("data.score");

        assertEquals(50, score);
    }

    @Test
    @TestSecurity(user = "owner-noclient")
    void liveAnswersNeedAPlayerId() {
        var quiz = createScoredQuiz();
        startSession(quiz[0]);

        given().contentType(ContentType.JSON)
            .body("{\"respondentName\":\"Anon\",\"answers\":[{\"questionId\":\"" + quiz[1]
                + "\",\"value\":\"" + quiz[2] + "\"}]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(400);
    }

    private int scoreFor(String[] quiz, String player) {
        return given().contentType(ContentType.JSON)
            .body("{\"respondentName\":\"" + player + "\",\"clientId\":\"" + player + "\","
                + "\"answers\":[{\"questionId\":\"" + quiz[1] + "\",\"value\":\"" + quiz[2] + "\"}]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(201).extract().path("data.score");
    }

    private void show(String[] quiz, String phase) {
        given().contentType(ContentType.JSON)
            .body("{\"index\":0,\"phase\":\"" + phase + "\"}")
            .when().post(SURVEYS + "/" + quiz[0] + "/live/state")
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-timing")
    void speedBonusOnlyCountsWhileTheQuestionIsShown() {
        var quiz = createScoredQuiz(", \"liveQuestionSeconds\": 20");
        startSession(quiz[0]);

        show(quiz, "question");
        assertTrue(scoreFor(quiz, "quick") > 90);
        show(quiz, "reveal");
        assertEquals(50, scoreFor(quiz, "late"));
    }

    @Test
    @TestSecurity(user = "owner-once-per-browser")
    void livePlayersAreNotBlockedByOneResponsePerBrowser() {
        var quiz = createScoredQuiz(", \"onePerBrowser\": true");
        startSession(quiz[0]);
        assertEquals(201, pick(quiz, "Repeat", quiz[2]));
        startSession(quiz[0]);
        assertEquals(201, pick(quiz, "Repeat", quiz[2]));
    }
}
