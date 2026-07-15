package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Avg completion time is preview-aware and skips untimed responses (#). */
@QuarkusTest
class AvgDurationResultsTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-avgdur")
    void avgDurationExcludesPreviewAndNullDurations() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"D\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "D", "status": "published",
                  "questions": [{"type":"short-answer","title":"Name","required":false,"order":0}],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");

        // Two timed real submissions (2000ms + 4000ms → mean 3000ms).
        submit(id, qId, "A", 2000, false);
        submit(id, qId, "B", 4000, false);
        // Real submission without a duration → ignored in the mean.
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"C\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
        // Preview submission with a large duration → excluded by default.
        submit(id, qId, "P", 100000, true);

        // Default results: mean over the two timed real rows only.
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.avgDurationMs", is(3000));

        // ?preview=true folds the preview row in: (2000+4000+100000)/3 = 35333.33 → 35333.
        given().when().get(SURVEYS + "/" + id + "/results?preview=true")
            .then().statusCode(200)
            .body("data.avgDurationMs", is(35333));
    }

    @Test
    @TestSecurity(user = "owner-avgdur-empty")
    void avgDurationIsNullWhenNoTimedResponses() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"E\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "E", "status": "published",
                  "questions": [{"type":"short-answer","title":"Name","required":false,"order":0}],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.avgDurationMs", nullValue());
    }

    private static void submit(String surveyId, String qId, String value, long durationMs, boolean preview) {
        given().contentType(ContentType.JSON)
            .body("{\"preview\":" + preview + ",\"durationMs\":" + durationMs
                + ",\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"" + value + "\"}]}")
            .when().post(surveyId != null ? SURVEYS + "/" + surveyId + "/responses" : "")
            .then().statusCode(201);
    }
}
