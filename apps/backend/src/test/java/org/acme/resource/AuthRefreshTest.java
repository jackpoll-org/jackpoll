package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/** Tests the silent re-auth endpoint's failure path (issue #35). */
@QuarkusTest
class AuthRefreshTest {

    private static final String REFRESH = "/api/v1/auth/refresh";

    @Test
    void refreshWithoutCookieReturns401AndClearsCookie() {
        given()
            .when().post(REFRESH)
            .then()
            .statusCode(401)
            .body("success", is(false))
            .body("error", containsString("session has expired"))
            // The (absent/invalid) refresh cookie is explicitly cleared.
            .header("Set-Cookie", containsString("refresh_token="))
            .header("Set-Cookie", containsString("Max-Age=0"));
    }

    @Test
    void refreshWithInvalidCookieReturns401() {
        given()
            .cookie("refresh_token", "not-a-real-token")
            .when().post(REFRESH)
            .then()
            .statusCode(401)
            .body("success", is(false));
    }

    /** Native clients send the offline token via header instead of a cookie. */
    @Test
    void refreshWithInvalidHeaderTokenReturns401() {
        given()
            .header("X-Refresh-Token", "not-a-real-token")
            .when().post(REFRESH)
            .then()
            .statusCode(401)
            .body("success", is(false));
    }
}
