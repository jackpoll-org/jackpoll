package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasSize;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Content blocks — display-only text/images between questions (public #7). */
@QuarkusTest
class ContentBlockTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void contentBlockPublishesWithoutTitleAndNeverCollectsAnswers() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Reading\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        var saved = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Reading", "status": "published",
                  "questions": [
                    { "type": "content", "title": "", "required": false, "order": 0,
                      "description": "Read the **source text** below." },
                    { "type": "short-answer", "title": "Who wrote it?",
                      "required": true, "order": 1 }
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].type", is("content"))
            .body("data.questions[0].description", is("Read the **source text** below."))
            .extract();
        String contentId = saved.path("data.questions[0].id");
        String questionId = saved.path("data.questions[1].id");

        // A client sending a value for the content block must not store it.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":["
                + "{\"questionId\":\"" + contentId + "\",\"value\":\"sneaky\"},"
                + "{\"questionId\":\"" + questionId + "\",\"value\":\"Goethe\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        given()
            .when().get(SURVEYS + "/" + id + "/responses")
            .then().statusCode(200)
            .body("data[0].answers", hasSize(1))
            .body("data[0].answers[0].questionId", is(questionId));

        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions", hasSize(1))
            .body("data.questions[0].questionId", is(questionId));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void answerableQuestionsStillNeedATitleToPublish() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Untitled\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("""
                { "title": "Untitled", "status": "published",
                  "questions": [{ "type": "short-answer", "title": "", "required": false, "order": 0 }] }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(422);
    }
}
