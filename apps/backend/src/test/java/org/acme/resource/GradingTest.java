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
                               "allowMultipleResponses": true},
                  "questions": [
                    {"id":"mc-%1$s","type":"multiple-choice","title":"SQL?","required":false,
                     "order":0,"points":1,"correctAnswers":["ok-%1$s"],
                     "options":[{"id":"ok-%1$s","label":"Yes"},{"id":"no-%1$s","label":"No"}]},
                    {"id":"essay-%1$s","type":"long-answer","title":"Primary vs foreign key",
                     "required":false,"order":1,"points":5}
                  ]
                }
                """.formatted(p))
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
        grade(quiz, responseId, quiz.mc(), 1).statusCode(400);      // auto-scored question
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
}
