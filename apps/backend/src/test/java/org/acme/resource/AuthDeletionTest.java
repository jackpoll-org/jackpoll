package org.acme.resource;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/**
 * Endpoint-level checks for the public (no-login) account/data deletion flows:
 * request validation and the "invalid email or password" / "invalid or expired
 * code" paths that don't require a live Keycloak. The full happy path (password
 * verified, code issued, data/account erased) is exercised at the service layer.
 */
@QuarkusTest
class AuthDeletionTest {

    @Test
    void requestAccountDeletionWithUnknownEmailIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.20")
            .body("{\"email\":\"nobody@example.com\",\"password\":\"whatever\"}")
            .when().post("/api/v1/auth/delete-account/request")
            .then().statusCode(400);
    }

    @Test
    void requestAccountDeletionRejectsBlankPassword() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.21")
            .body("{\"email\":\"nobody@example.com\",\"password\":\"\"}")
            .when().post("/api/v1/auth/delete-account/request")
            .then().statusCode(422);
    }

    @Test
    void confirmAccountDeletionWithUnknownCodeIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.22")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"654321\"}")
            .when().post("/api/v1/auth/delete-account/confirm")
            .then().statusCode(400);
    }

    @Test
    void confirmAccountDeletionRejectsNonSixDigitCode() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.23")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"12\"}")
            .when().post("/api/v1/auth/delete-account/confirm")
            .then().statusCode(422);
    }

    @Test
    void requestDataDeletionWithUnknownEmailIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.24")
            .body("{\"email\":\"nobody@example.com\",\"password\":\"whatever\"}")
            .when().post("/api/v1/auth/delete-data/request")
            .then().statusCode(400);
    }

    @Test
    void confirmDataDeletionWithUnknownCodeIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.25")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"654321\"}")
            .when().post("/api/v1/auth/delete-data/confirm")
            .then().statusCode(400);
    }

    @Test
    void confirmDataDeletionRejectsNonSixDigitCode() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.26")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"12\"}")
            .when().post("/api/v1/auth/delete-data/confirm")
            .then().statusCode(422);
    }
}
