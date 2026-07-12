package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.not;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Brute-force guard on the public auth endpoints (#56). */
@QuarkusTest
@TestProfile(AuthRateLimitTest.SmallLimit.class)
class AuthRateLimitTest {

    public static class SmallLimit implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                "survey.auth.rate-limit.max", "3",
                "survey.auth.rate-limit.window-seconds", "60");
        }
    }

    @Test
    void loginIsRateLimitedAfterTooManyAttempts() {
        String body = "{\"email\":\"attacker@example.com\",\"password\":\"wrong-pw\"}";

        // First 3 attempts are within the limit (whatever auth returns, not 429).
        for (int i = 0; i < 3; i++) {
            given()
                .contentType(ContentType.JSON)
                .header("X-Forwarded-For", "203.0.113.7")
                .body(body)
                .when().post("/api/v1/auth/login")
                .then().statusCode(not(429));
        }

        // The next attempt is throttled.
        given()
            .contentType(ContentType.JSON)
            .header("X-Forwarded-For", "203.0.113.7")
            .body(body)
            .when().post("/api/v1/auth/login")
            .then().statusCode(429);
    }
}
