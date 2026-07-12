package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.containsString;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/**
 * Drafts can be saved incomplete (untitled questions, empty options); the
 * completeness checks only fire on the publish transition (#).
 */
@QuarkusTest
class DraftPublishValidationTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Draft\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
    }

    @Test
    @TestSecurity(user = "owner-draft")
    void draftSavesWithBlankQuestionTitleAndOption() {
        String id = createSurvey();
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Draft", "status": "draft",
                  "questions": [
                    {"type":"short-answer","title":"","required":false,"order":0},
                    {"type":"multiple-choice","title":"Pick","required":false,"order":1,
                     "options":[{"id":"o1","label":""}]}
                  ],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-draft")
    void publishRejectsBlankQuestionTitle() {
        String id = createSurvey();
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Draft", "status": "published",
                  "questions": [
                    {"type":"short-answer","title":"","required":false,"order":0}
                  ],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(422)
            .body("success", is(false))
            .body("error", containsString("Question 1"));
    }

    @Test
    @TestSecurity(user = "owner-draft")
    void publishSucceedsWhenComplete() {
        String id = createSurvey();
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Draft", "status": "published",
                  "questions": [
                    {"type":"short-answer","title":"Your name","required":false,"order":0}
                  ],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
    }
}
