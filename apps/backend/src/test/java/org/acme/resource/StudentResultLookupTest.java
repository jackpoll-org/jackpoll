package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;

import org.acme.service.RateLimiterService;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;

@QuarkusTest
class StudentResultLookupTest {

    @Inject
    RateLimiterService rateLimiter;

    private static int lookup(String surveyId, String ip) {
        return given().contentType(ContentType.JSON)
            .header("X-Forwarded-For", ip)
            .body("{\"code\":\"NOPE1234\"}")
            .when().post("/api/v1/public/surveys/" + surveyId + "/result")
            .then().extract().statusCode();
    }

    @Test
    void oneGuessersMissesDoNotLockOutTheClass() {
        String id = UUID.randomUUID().toString();
        String guesser = "198.51.100.140";
        for (int i = 0; i < 60; i++) {
            rateLimiter.allow("result-miss|" + id + "|" + ClientIp.bucket(guesser), 60, 3600);
        }

        assertEquals(429, lookup(id, guesser));
        assertEquals(404, lookup(id, "198.51.100.141"));
    }
}
