package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Integration tests for anonymous save &amp; resume drafts (issue #26). */
@QuarkusTest
class DraftResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";
    private static final String DRAFTS = "/api/v1/public/drafts";

    /** Create a survey (requires the caller to be authenticated). */
    private static String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Draftable\"}")
            .when().post(SURVEYS)
            .then().statusCode(201)
            .extract().path("data.id");
    }

    @Test
    @TestSecurity(user = "owner-1")
    void saveAndResumeRoundTrip() {
        String id = createSurvey();

        // anonymous-style save → returns an unguessable token
        String token = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"q1\",\"value\":\"hello\"}],\"position\":2}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200)
            .body("success", is(true))
            .body("data.token", notNullValue())
            .body("data.surveyId", is(id))
            .body("data.position", is(2))
            .extract().path("data.token");

        // resume by token restores answers + position
        given()
            .when().get(DRAFTS + "/" + token)
            .then().statusCode(200)
            .body("data.surveyId", is(id))
            .body("data.position", is(2))
            .body("data.answers[0].questionId", is("q1"))
            .body("data.answers[0].value", is("hello"));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void saveWithTokenUpdatesSameDraft() {
        String id = createSurvey();

        String token = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"q1\",\"value\":\"first\"}],\"position\":0}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200).extract().path("data.token");

        // re-save with the same token → same token back, updated content
        given()
            .contentType(ContentType.JSON)
            .body("{\"token\":\"" + token + "\",\"answers\":[{\"questionId\":\"q1\",\"value\":\"second\"}],\"position\":1}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200)
            .body("data.token", is(token));

        given()
            .when().get(DRAFTS + "/" + token)
            .then().statusCode(200)
            .body("data.answers[0].value", is("second"))
            .body("data.position", is(1));
    }

    @Test
    void unknownTokenReturns404() {
        given().when().get(DRAFTS + "/does-not-exist").then().statusCode(404);
    }

    @Test
    void saveForUnknownSurveyReturns404() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(PUBLIC + "/nope/drafts")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void discardRemovesDraft() {
        String id = createSurvey();

        String token = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"q1\",\"value\":\"x\"}]}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200).extract().path("data.token");

        given().when().delete(DRAFTS + "/" + token).then().statusCode(204);
        given().when().get(DRAFTS + "/" + token).then().statusCode(404);
        // deleting again is idempotent
        given().when().delete(DRAFTS + "/" + token).then().statusCode(204);
    }
}
