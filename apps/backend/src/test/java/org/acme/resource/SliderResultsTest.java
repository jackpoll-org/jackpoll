package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.lessThan;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Slider question type — numeric answers aggregate into a histogram. */
@QuarkusTest
class SliderResultsTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void sliderAnswersAggregateIntoAHistogram() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Rating\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Rating", "status": "published",
                  "questions": [{
                    "type": "slider", "title": "How likely to recommend?",
                    "required": true, "order": 0,
                    "settings": { "min": 0, "max": 10, "step": 1 }
                  }]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].type", is("slider"))
            .extract().path("data.questions[0].id");

        for (int value : new int[] { 8, 8, 3 }) {
            given()
                .contentType(ContentType.JSON)
                .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":" + value + "}]}")
                .when().post(SURVEYS + "/" + id + "/responses")
                .then().statusCode(201);
        }

        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.totalResponses", is(3))
            .body("data.questions[0].answered", is(3))
            .body("data.questions[0].optionCounts.'8'", is(2))
            .body("data.questions[0].optionCounts.'3'", is(1))
            // Mean (8+8+3)/3 ≈ 6.33, median 8 (#55).
            .body("data.questions[0].average", greaterThan(6.3f))
            .body("data.questions[0].average", lessThan(6.4f))
            .body("data.questions[0].median", is(8.0f));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsSliderAnswerOutOfRange() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Range\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Range", "status": "published",
                  "questions": [{
                    "type": "slider", "title": "0-10", "required": true, "order": 0,
                    "settings": { "min": 0, "max": 10 }
                  }]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":99}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400);
    }
}
