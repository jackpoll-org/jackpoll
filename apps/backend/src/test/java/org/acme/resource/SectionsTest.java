package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Round-trip tests for multi-page sections (issue #28). */
@QuarkusTest
class SectionsTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void sectionsAndQuestionSectionIdRoundTrip() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Paged\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Paged",
                  "status": "draft",
                  "sections": [
                    {"id":"sec-1","title":"About you","order":0},
                    {"id":"sec-2","title":"Feedback","order":1,
                     "visibleIf":{"match":"all","conditions":[]}}
                  ],
                  "questions": [
                    {"type":"short-answer","title":"Name","required":false,"order":0,
                     "sectionId":"sec-1"},
                    {"type":"short-answer","title":"Comments","required":false,"order":1,
                     "sectionId":"sec-2"}
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.sections.size()", is(2))
            .body("data.sections[0].id", is("sec-1"))
            .body("data.sections[0].title", is("About you"))
            .body("data.sections[1].id", is("sec-2"))
            .body("data.sections[1].visibleIf", notNullValue())
            .body("data.questions[0].sectionId", is("sec-1"))
            .body("data.questions[1].sectionId", is("sec-2"));

        // re-fetch to confirm persistence
        given()
            .when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.sections.size()", is(2))
            .body("data.questions[1].sectionId", is("sec-2"));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void flatSurveyHasNoSections() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Flat\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.sections.size()", is(0));
    }
}
