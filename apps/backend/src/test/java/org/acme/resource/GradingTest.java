package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Student-by-student grading of manually scored answers (public #6). */
@QuarkusTest
class GradingTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String EDIT = "/api/v1/public/responses";

    /** Quiz: one auto-scored choice (1 pt) + one paragraph worth 5, pass at 6. */
    private static Quiz createQuiz() {
        return createQuiz("");
    }

    private static Quiz createQuiz(String extraSettings) {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Databases test\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Databases test", "status": "published",
                  "settings": {"isQuiz": true, "passingScore": 6, "allowEditResponses": true,
                               "allowMultipleResponses": true%2$s},
                  "questions": [
                    {"id":"mc-%1$s","type":"multiple-choice","title":"SQL?","required":false,
                     "order":0,"points":1,"correctAnswers":["ok-%1$s"],
                     "options":[{"id":"ok-%1$s","label":"Yes"},{"id":"no-%1$s","label":"No"}]},
                    {"id":"essay-%1$s","type":"long-answer","title":"Primary vs foreign key",
                     "required":false,"order":1,"points":5}
                  ]
                }
                """.formatted(p, extraSettings))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return new Quiz(id, "mc-" + p, "ok-" + p, "essay-" + p);
    }

    private record Quiz(String id, String mc, String right, String essay) {}

    private static io.restassured.response.ValidatableResponse submit(Quiz quiz, String essay) {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":["
                + "{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"" + quiz.right() + "\"},"
                + "{\"questionId\":\"" + quiz.essay() + "\",\"value\":\"" + essay + "\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201);
    }

    private static io.restassured.response.ValidatableResponse grade(
        Quiz quiz, String responseId, String questionId, Object points) {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"grades\":[{\"questionId\":\"" + questionId + "\",\"points\":" + points + "}]}")
            .when().put(SURVEYS + "/" + quiz.id() + "/responses/" + responseId + "/grades")
            .then();
    }

    @Test
    @TestSecurity(user = "owner-1")
    void manualPointsCompleteTheScoreAndDecidePassing() {
        var quiz = createQuiz();
        String responseId = submit(quiz, "A primary key identifies a row.")
            .body("data.score", is(1))
            .body("data.maxScore", is(6))
            .body("data.passed", nullValue())
            .body("data.gradingPending", is(true))
            .extract().path("data.id");

        grade(quiz, responseId, quiz.essay(), 5).statusCode(200)
            .body("data.score", is(6))
            .body("data.passed", is(true))
            .body("data.gradingPending", nullValue());

        given().when().get(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(200)
            .body("data[0].score", is(6))
            .body("data[0].answers.find { it.questionId == '" + quiz.essay() + "' }.awardedPoints", is(5));

        // Clearing the grade puts the response back to pending.
        grade(quiz, responseId, quiz.essay(), "null").statusCode(200)
            .body("data.score", is(1))
            .body("data.gradingPending", is(true));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsInvalidGrades() {
        var quiz = createQuiz();
        String responseId = submit(quiz, "Some text").extract().path("data.id");

        grade(quiz, responseId, quiz.essay(), 6).statusCode(400);   // above max
        grade(quiz, responseId, quiz.essay(), -1).statusCode(400);  // negative
        grade(quiz, responseId, quiz.mc(), 2).statusCode(400);      // auto-scored, above max
        grade(quiz, responseId, "nope", 1).statusCode(400);         // unknown question
        given().contentType(ContentType.JSON)                          // no body → validation error, not a 500
            .when().put(SURVEYS + "/" + quiz.id() + "/responses/" + responseId + "/grades")
            .then().statusCode(422);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void unchangedAnswersKeepTheirGradeWhenTheRespondentEdits() {
        var quiz = createQuiz();
        var created = submit(quiz, "Original").extract();
        String responseId = created.path("data.id");
        String token = created.path("data.editToken");
        grade(quiz, responseId, quiz.essay(), 4).statusCode(200).body("data.score", is(5));

        // Same essay, other choice → grade kept, auto part re-scored.
        given().contentType(ContentType.JSON)
            .body("{\"answers\":["
                + "{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"no-" + quiz.id().substring(0, 8) + "\"},"
                + "{\"questionId\":\"" + quiz.essay() + "\",\"value\":\"Original\"}]}")
            .when().put(EDIT + "/" + token)
            .then().statusCode(200)
            .body("data.score", is(4))
            .body("data.gradingPending", nullValue());

        // Rewritten essay → needs grading again.
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + quiz.essay() + "\",\"value\":\"Rewritten\"}]}")
            .when().put(EDIT + "/" + token)
            .then().statusCode(200)
            .body("data.score", is(0))
            .body("data.gradingPending", is(true));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void teacherCanOverrideAutoScoredAnswers() {
        var quiz = createQuiz();
        String responseId = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"no-"
                + quiz.id().substring(0, 8) + "\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201)
            .body("data.score", is(0))
            .extract().path("data.id");

        grade(quiz, responseId, quiz.mc(), 1).statusCode(200)
            .body("data.score", is(1))
            .body("data.answers.find { it.questionId == '" + quiz.mc() + "' }.autoPoints", is(0))
            .body("data.answers.find { it.questionId == '" + quiz.mc() + "' }.awardedPoints", is(1));

        grade(quiz, responseId, quiz.mc(), "null").statusCode(200)
            .body("data.score", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void bonusPointsFeedbackAndGradingKey() {
        var quiz = createQuiz(", \"gradingScale\": [{\"label\":\"A\",\"minScore\":7},"
            + "{\"label\":\"B\",\"minScore\":4},{\"label\":\"F\",\"minScore\":0}]");
        String responseId = submit(quiz, "Essay").extract().path("data.id");
        grade(quiz, responseId, quiz.essay(), 3).statusCode(200)
            .body("data.score", is(4))
            .body("data.grade", is("B"));

        review(quiz, responseId, "{\"bonusPoints\":3,\"feedback\":\"  Well done  \"}").statusCode(200)
            .body("data.score", is(7))
            .body("data.bonusPoints", is(3))
            .body("data.feedback", is("Well done"))
            .body("data.grade", is("A"));

        review(quiz, responseId, "{\"bonusPoints\":1001}").statusCode(422);

        review(quiz, responseId, "{}").statusCode(200)
            .body("data.score", is(4))
            .body("data.bonusPoints", nullValue())
            .body("data.feedback", nullValue());
    }

    @Test
    @TestSecurity(user = "owner-1")
    void studentsSeeTheirResultOnlyWithTheirCodeAfterRelease() {
        var quiz = createQuiz(", \"studentResults\": true");
        var created = submit(quiz, "Essay")
            .body("data.answers.find { it.questionId == '" + quiz.mc() + "' }.autoPoints", nullValue())
            .extract();
        String responseId = created.path("data.id");
        String code = created.path("data.resultCode");
        org.junit.jupiter.api.Assertions.assertEquals(6, code.length());
        grade(quiz, responseId, quiz.essay(), 5).statusCode(200);
        review(quiz, responseId, "{\"feedback\":\"Great\"}").statusCode(200);

        lookup(quiz, code).statusCode(404);

        releaseResults(quiz);

        lookup(quiz, code.substring(0, 4).toLowerCase() + "-" + code.substring(4)).statusCode(200)
            .body("data.response.score", is(6))
            .body("data.response.feedback", is("Great"))
            .body("data.response.editToken", nullValue())
            .body("data.response.answers.find { it.questionId == '" + quiz.mc() + "' }.autoPoints", is(1))
            .body("data.survey.questions[0].correctAnswers", nullValue());
        lookup(quiz, "WRONGCODE").statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void resultLookupNeverRevealsTheRespondentToken() {
        var quiz = createQuiz(", \"studentResults\": true, \"requireRespondentToken\": true");
        given().contentType(ContentType.JSON).body("{\"tokens\":[\"alice\"]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/respondent-tokens")
            .then().statusCode(200);
        String code = given()
            .contentType(ContentType.JSON)
            .body("{\"respondentToken\":\"alice\",\"answers\":["
                + "{\"questionId\":\"" + quiz.essay() + "\",\"value\":\"Essay\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201)
            .body("data.respondentToken", is("alice"))
            .extract().path("data.resultCode");

        releaseResults(quiz, ", \"requireRespondentToken\": true");

        lookup(quiz, code).statusCode(200)
            .body("data.response.respondentToken", nullValue())
            .body("data.response.editToken", nullValue());
    }

    private static void releaseResults(Quiz quiz) {
        releaseResults(quiz, "");
    }

    private static void releaseResults(Quiz quiz, String extraSettings) {
        String p = quiz.id().substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Databases test", "status": "published",
                  "settings": {"isQuiz": true, "passingScore": 6, "allowEditResponses": true,
                               "allowMultipleResponses": true, "studentResults": true,
                               "resultsReleased": true%2$s},
                  "questions": [
                    {"id":"mc-%1$s","type":"multiple-choice","title":"SQL?","required":false,
                     "order":0,"points":1,"correctAnswers":["ok-%1$s"],
                     "options":[{"id":"ok-%1$s","label":"Yes"},{"id":"no-%1$s","label":"No"}]},
                    {"id":"essay-%1$s","type":"long-answer","title":"Primary vs foreign key",
                     "required":false,"order":1,"points":5}
                  ]
                }
                """.formatted(p, extraSettings))
            .when().put(SURVEYS + "/" + quiz.id())
            .then().statusCode(200);
    }

    private static io.restassured.response.ValidatableResponse review(
        Quiz quiz, String responseId, String body) {
        return given().contentType(ContentType.JSON).body(body)
            .when().put(SURVEYS + "/" + quiz.id() + "/responses/" + responseId + "/review")
            .then();
    }

    private static io.restassured.response.ValidatableResponse lookup(Quiz quiz, String code) {
        return given().contentType(ContentType.JSON).body("{\"code\":\"" + code + "\"}")
            .when().post("/api/v1/public/surveys/" + quiz.id() + "/result")
            .then();
    }

    @Test
    @TestSecurity(user = "owner-1")
    void overridesFollowTheCurrentAnswerKey() {
        var quiz = createQuiz();
        String p = quiz.id().substring(0, 8);
        String responseId = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"no-" + p + "\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201).body("data.score", is(0))
            .extract().path("data.id");

        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Databases test", "status": "published",
                  "settings": {"isQuiz": true, "passingScore": 6, "allowMultipleResponses": true},
                  "questions": [
                    {"id":"mc-%1$s","type":"multiple-choice","title":"SQL?","required":false,
                     "order":0,"points":1,"correctAnswers":["no-%1$s"],
                     "options":[{"id":"ok-%1$s","label":"Yes"},{"id":"no-%1$s","label":"No"}]},
                    {"id":"essay-%1$s","type":"long-answer","title":"Primary vs foreign key",
                     "required":false,"order":1,"points":5}
                  ]
                }
                """.formatted(p))
            .when().put(SURVEYS + "/" + quiz.id())
            .then().statusCode(200);

        grade(quiz, responseId, quiz.mc(), 0).statusCode(200).body("data.score", is(0));
        grade(quiz, responseId, quiz.mc(), "null").statusCode(200).body("data.score", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void gradesOneQuestionAcrossSubmissionsInOneGo() {
        var quiz = createQuiz();
        String first = submit(quiz, "Same answer").extract().path("data.id");
        String second = submit(quiz, "Same answer").extract().path("data.id");
        String url = SURVEYS + "/" + quiz.id() + "/questions/" + quiz.essay() + "/grades";

        given().contentType(ContentType.JSON)
            .body("{\"grades\":[{\"responseId\":\"" + first + "\",\"points\":3},"
                + "{\"responseId\":\"" + second + "\",\"points\":3}]}")
            .when().put(url)
            .then().statusCode(200)
            .body("data.size()", is(2))
            .body("data[0].score", is(4))
            .body("data[1].score", is(4));

        given().contentType(ContentType.JSON)
            .body("{\"grades\":[{\"responseId\":\"" + first + "\",\"points\":5},"
                + "{\"responseId\":\"" + second + "\",\"points\":9}]}")
            .when().put(url)
            .then().statusCode(400);
        given().when().get(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(200)
            .body("data.findAll { it.id == '" + first + "' }[0].score", is(4));

        given().contentType(ContentType.JSON)
            .body("{\"grades\":[{\"responseId\":\"nope\",\"points\":1}]}")
            .when().put(url).then().statusCode(404);
        given().contentType(ContentType.JSON).body("{\"grades\":[]}")
            .when().put(SURVEYS + "/" + quiz.id() + "/questions/unknown/grades").then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "stranger")
    void cannotGradeQuestionsOfSomeoneElsesSurvey() {
        given().contentType(ContentType.JSON).body("{\"grades\":[]}")
            .when().put(SURVEYS + "/not-mine/questions/q/grades")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void storedScoresFollowWhenPartialCreditIsSwitchedOn() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Checkboxes\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        String survey = """
            {"title":"Checkboxes","status":"published","settings":{"isQuiz":true,"allowMultipleResponses":true},
             "questions":[{"id":"cb-%1$s","type":"checkboxes","title":"Pick","required":false,"order":0,
               "points":2,"correctAnswers":["a-%1$s","b-%1$s"],"settings":{"partialCredit":%2$s},
               "options":[{"id":"a-%1$s","label":"A"},{"id":"b-%1$s","label":"B"},{"id":"c-%1$s","label":"C"}]}]}
            """;
        given().contentType(ContentType.JSON).body(survey.formatted(p, "false"))
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"cb-" + p + "\",\"value\":[\"a-" + p + "\"]}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.score", is(0));

        given().contentType(ContentType.JSON).body(survey.formatted(p, "true"))
            .when().put(SURVEYS + "/" + id).then().statusCode(200);

        given().when().get(SURVEYS + "/" + id + "/responses")
            .then().statusCode(200)
            .body("data[0].score", is(1))
            .body("data[0].answers[0].autoPoints", is(1));
    }

    @Test
    void gradingRequiresSignIn() {
        given().contentType(ContentType.JSON).body("{\"grades\":[]}")
            .when().put(SURVEYS + "/x/responses/y/grades")
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "stranger")
    void cannotGradeSomeoneElsesSurvey() {
        given().contentType(ContentType.JSON).body("{\"grades\":[]}")
            .when().put(SURVEYS + "/not-mine/responses/y/grades")
            .then().statusCode(404);
    }
    private static io.restassured.response.ValidatableResponse feedback(
        Quiz quiz, String questionId, String responseId, String text) {
        return given().contentType(ContentType.JSON)
            .body(java.util.Map.of("responseIds", java.util.List.of(responseId), "feedback", text))
            .when().put(SURVEYS + "/" + quiz.id() + "/questions/" + questionId + "/feedback")
            .then();
    }

    private static String essayOf(Quiz quiz, String field) {
        return "data.response.answers.find { it.questionId == '" + quiz.essay() + "' }." + field;
    }

    @Test
    @TestSecurity(user = "owner-1")
    void feedbackPerAnswerLeavesPointsAloneAndReachesTheStudentAfterRelease() {
        var quiz = createQuiz(", \"studentResults\": true");
        var created = submit(quiz, "Essay").extract();
        String responseId = created.path("data.id");
        String code = created.path("data.resultCode");
        String token = created.path("data.editToken");
        String essay = "data[0].answers.find { it.questionId == '" + quiz.essay() + "' }.";

        grade(quiz, responseId, quiz.essay(), 4).statusCode(200);
        feedback(quiz, quiz.essay(), responseId, "  Name the foreign key.  ").statusCode(200)
            .body(essay + "feedback", is("Name the foreign key."))
            .body(essay + "awardedPoints", is(4));
        grade(quiz, responseId, quiz.essay(), 5).statusCode(200);
        feedback(quiz, quiz.mc(), responseId, "Right.").statusCode(200);

        given().contentType(ContentType.JSON)
            .body("{\"answers\":["
                + "{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"" + quiz.right() + "\"},"
                + "{\"questionId\":\"" + quiz.essay() + "\",\"value\":\"Essay\"}]}")
            .when().put(EDIT + "/" + token)
            .then().statusCode(200);

        lookup(quiz, code).statusCode(404);
        releaseResults(quiz);
        lookup(quiz, code).statusCode(200)
            .body(essayOf(quiz, "feedback"), is("Name the foreign key."))
            .body(essayOf(quiz, "awardedPoints"), is(5));

        feedback(quiz, quiz.essay(), responseId, " ").statusCode(200)
            .body(essay + "feedback", nullValue());
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsInvalidAnswerFeedback() {
        var quiz = createQuiz();
        String responseId = given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + quiz.mc() + "\",\"value\":\"" + quiz.right() + "\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201).extract().path("data.id");

        feedback(quiz, quiz.essay(), responseId, "Nothing to comment on").statusCode(400);
        feedback(quiz, "nope", responseId, "Unknown question").statusCode(400);
        feedback(quiz, quiz.mc(), "missing", "Unknown response").statusCode(404);
        feedback(quiz, quiz.mc(), responseId, "x".repeat(2001)).statusCode(422);

        releaseResults(quiz, ", \"liveMode\": true");
        feedback(quiz, quiz.mc(), responseId, "Not shown to players").statusCode(400);
    }

    @Test
    @TestSecurity(user = "stranger")
    void cannotGiveFeedbackOnSomeoneElsesSurvey() {
        given().contentType(ContentType.JSON).body("{\"responseIds\":[\"y\"],\"feedback\":\"Hi\"}")
            .when().put(SURVEYS + "/not-mine/questions/q/feedback")
            .then().statusCode(404);
    }

    @Test
    void answerFeedbackRequiresSignIn() {
        given().contentType(ContentType.JSON).body("{\"responseIds\":[\"y\"],\"feedback\":\"Hi\"}")
            .when().put(SURVEYS + "/x/questions/q/feedback")
            .then().statusCode(401);
    }
}
