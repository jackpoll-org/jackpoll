package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.restassured.response.ExtractableResponse;
import io.restassured.response.Response;
import org.junit.jupiter.api.Test;

/** Per-option response quotas (issue #38). */
@QuarkusTest
class OptionQuotaTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void optionStopsAcceptingOnceFull_andOwnerSeesRemaining() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Slots\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        ExtractableResponse<Response> put = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Slots", "status": "published",
                  "questions": [{
                    "type": "multiple-choice", "title": "Pick a slot",
                    "required": true, "order": 0,
                    "options": [
                      {"label": "Morning", "capacity": 1},
                      {"label": "Afternoon"}
                    ]
                  }]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].options[0].capacity", is(1))
            .body("data.questions[0].options[0].used", is(0))
            .extract();

        String qId = put.path("data.questions[0].id");
        String fullOpt = put.path("data.questions[0].options[0].id");
        String otherOpt = put.path("data.questions[0].options[1].id");

        // First pick of the capped option succeeds.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"" + fullOpt + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        // Second pick of the same option is rejected (409) — it is now full.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"" + fullOpt + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(409);

        // The uncapped option still accepts responses.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"" + otherOpt + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        // Owner sees the capped option's used counter at capacity.
        given()
            .when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].options[0].used", is(1))
            .body("data.questions[0].options[0].capacity", is(1));
    }
}
