package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Scheduled opening (opensAt) enforcement (issue #39). */
@QuarkusTest
class ScheduledOpeningTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsSubmissionBeforeOpensAt() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Scheduled\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        // Publish with an opensAt far in the future.
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Scheduled\",\"status\":\"published\",\"questions\":[],"
                + "\"settings\":{\"opensAt\":\"2999-01-01T00:00:00Z\"}}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.settings.opensAt", is("2999-01-01T00:00:00Z"));

        // Submissions are rejected until the open time arrives.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void acceptsSubmissionAfterOpensAt() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Open\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        // opensAt in the past → open now.
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Open\",\"status\":\"published\",\"questions\":[],"
                + "\"settings\":{\"opensAt\":\"2000-01-01T00:00:00Z\"}}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);
    }
}
