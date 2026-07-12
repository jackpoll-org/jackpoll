package org.acme.resource;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/**
 * Endpoint-level checks for the code-based email verification / password reset
 * (#security email-verify) that don't require a live Keycloak: request
 * validation and the "invalid or expired code" path (rejected before any admin
 * call). The full happy path is exercised at the service layer in
 * {@link org.acme.service.EmailCodeServiceTest}.
 */
@QuarkusTest
class AuthEmailVerifyTest {

    @Test
    void verifyEmailWithUnknownCodeIsRejected() {
        // No code was ever issued for this address → 400 (not a 500 / not a leak).
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.10")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"654321\"}")
            .when().post("/api/v1/auth/verify-email")
            .then().statusCode(400);
    }

    @Test
    void verifyEmailRejectsNonSixDigitCode() {
        // Bean-validation failure (code pattern) → 422 Unprocessable Entity.
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.11")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"12\"}")
            .when().post("/api/v1/auth/verify-email")
            .then().statusCode(422);
    }

    @Test
    void resetPasswordWithUnknownCodeIsRejected() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.12")
            .body("{\"email\":\"nobody@example.com\",\"code\":\"654321\",\"newPassword\":\"NewPass1\"}")
            .when().post("/api/v1/auth/reset-password")
            .then().statusCode(400);
    }

    @Test
    void resendVerificationAlwaysSucceeds() {
        // No account → still 200 (no email enumeration), nothing sent.
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.13")
            .body("{\"email\":\"nobody@example.com\"}")
            .when().post("/api/v1/auth/resend-verification")
            .then().statusCode(200);
    }

    @Test
    void forgotPasswordAlwaysSucceeds() {
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "198.51.100.14")
            .body("{\"email\":\"nobody@example.com\"}")
            .when().post("/api/v1/auth/forgot-password")
            .then().statusCode(200);
    }
}
