package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Integration tests for spam & bot protection on public submit (issue #31). */
@QuarkusTest
class SpamProtectionTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    @TestSecurity(user = "owner-1")
    private String publish(String settingsJson) {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Guarded\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Guarded\",\"status\":\"published\",\"questions\":[],"
                + "\"settings\":" + settingsJson + "}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return id;
    }

    @Test
    @TestSecurity(user = "owner-1")
    void honeypotIsSilentlyRejected_notStored() {
        String id = publish("{}");

        // bot fills the honeypot → looks like success but nothing is stored
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[],\"honeypot\":\"i-am-a-bot\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.totalResponses", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void tooFastSubmissionRejected_withoutValidBeginToken() {
        String id = publish("{\"minSubmitSeconds\":5}");

        // no begin-token at all → generic 400
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400)
            .body("success", is(false));

        // a freshly issued token (elapsed ~0 < 5s) → still rejected
        String token = given()
            .when().get(PUBLIC + "/" + id + "/begin")
            .then().statusCode(200)
            .body("data.beginToken", notNullValue())
            .extract().path("data.beginToken");

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[],\"beginToken\":\"" + token + "\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void duplicatePerBrowserRejected() {
        String id = publish("{\"onePerBrowser\":true}");

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[],\"clientId\":\"browser-abc\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        // same browser again → rejected
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[],\"clientId\":\"browser-abc\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400);

        // a different browser is fine
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[],\"clientId\":\"browser-xyz\"}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void captchaRequiredRejectsMissingPayload() {
        String id = publish("{\"requireCaptcha\":true}");

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void rateLimitReturns429AfterBurst() {
        String id = publish("{\"rateLimit\":true}");

        // default limit is 5 per window; the 6th is throttled
        for (int i = 0; i < 5; i++) {
            given()
                .contentType(ContentType.JSON)
                .body("{\"answers\":[]}")
                .when().post(SURVEYS + "/" + id + "/responses")
                .then().statusCode(201);
        }
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(429)
            .body("success", is(false));
    }

    @Test
    void altchaChallengeIsServed() {
        given()
            .when().get(PUBLIC + "/any/altcha")
            .then().statusCode(200)
            .body("algorithm", is("SHA-256"))
            .body("challenge", notNullValue())
            .body("salt", notNullValue())
            .body("signature", notNullValue());
    }
}
