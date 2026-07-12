package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Integration tests for owner-managed webhooks (issue #36). */
@QuarkusTest
class WebhookResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private static String newSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Hooked\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
    }

    @Test
    void requiresAuth() {
        given().when().get(SURVEYS + "/any/webhooks").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void crudLifecycle() {
        String id = newSurvey();

        // create
        String hookId = given()
            .contentType(ContentType.JSON)
            .body("{\"url\":\"https://example.com/hook\",\"enabled\":true}")
            .when().post(SURVEYS + "/" + id + "/webhooks")
            .then().statusCode(201)
            .body("data.url", is("https://example.com/hook"))
            .body("data.enabled", is(true))
            .body("data.secret", notNullValue()) // signing secret returned to owner
            .extract().path("data.id");

        // list
        given()
            .when().get(SURVEYS + "/" + id + "/webhooks")
            .then().statusCode(200)
            .body("data.size()", is(1))
            .body("data[0].id", is(hookId));

        // delete
        given()
            .when().delete(SURVEYS + "/" + id + "/webhooks/" + hookId)
            .then().statusCode(200);

        given()
            .when().get(SURVEYS + "/" + id + "/webhooks")
            .then().statusCode(200)
            .body("data.size()", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsNonHttpUrl() {
        String id = newSurvey();
        given()
            .contentType(ContentType.JSON)
            .body("{\"url\":\"ftp://example.com/hook\",\"enabled\":true}")
            .when().post(SURVEYS + "/" + id + "/webhooks")
            .then().statusCode(greaterThan(399));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void testEventReportsUnreachableEndpoint() {
        String id = newSurvey();
        // Port 1 refuses fast (allow-private is on in %test), so delivery fails
        // cleanly with a recorded error rather than throwing.
        String hookId = given()
            .contentType(ContentType.JSON)
            .body("{\"url\":\"http://127.0.0.1:1/hook\",\"enabled\":true}")
            .when().post(SURVEYS + "/" + id + "/webhooks")
            .then().statusCode(201).extract().path("data.id");

        given()
            .when().post(SURVEYS + "/" + id + "/webhooks/" + hookId + "/test")
            .then().statusCode(200)
            .body("data.delivered", is(false))
            .body("data.error", notNullValue());
    }
}
