package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.contains;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Long answer (paragraph) question type — multi-line free text (public #8). */
@QuarkusTest
class LongAnswerTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void multiLineAnswersAreKeptVerbatimInResults() {
        String id = createSurvey();
        String qId = addLongAnswerQuestion(id);

        submit(id, qId, "\"First paragraph.\\n\\nSecond paragraph.\"").then().statusCode(201);

        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions[0].type", is("long-answer"))
            .body("data.questions[0].textAnswers", contains("First paragraph.\n\nSecond paragraph."));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsNonTextAndOverlongAnswers() {
        String id = createSurvey();
        String qId = addLongAnswerQuestion(id);

        submit(id, qId, "42").then().statusCode(400);
        submit(id, qId, "\"" + "a".repeat(10_001) + "\"").then().statusCode(400);
        submit(id, qId, "\"" + "a".repeat(10_000) + "\"").then().statusCode(201);
    }

    private static String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Essay\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
    }

    private static String addLongAnswerQuestion(String surveyId) {
        return given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Essay", "status": "published",
                  "questions": [{
                    "type": "long-answer", "title": "Explain primary vs foreign keys",
                    "required": true, "order": 0
                  }]
                }
                """)
            .when().put(SURVEYS + "/" + surveyId)
            .then().statusCode(200)
            .body("data.questions[0].type", is("long-answer"))
            .extract().path("data.questions[0].id");
    }

    private static io.restassured.response.Response submit(String surveyId, String qId, String valueJson) {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":" + valueJson + "}]}")
            .when().post(SURVEYS + "/" + surveyId + "/responses");
    }
}
