package org.acme.resource;

import static io.restassured.RestAssured.given;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PublicWriteRateLimitTest.SmallLimit.class)
class PublicWriteRateLimitTest {

    private static final String SURVEYS = "/api/v1/surveys";

    public static class SmallLimit implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("survey.public-write.rate-limit.max", "2");
        }
    }

    private String publishedSurvey() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Busy\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Busy\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        return id;
    }

    @Test
    @TestSecurity(user = "owner-busy")
    void submissionsAreThrottledPerIpEvenWithoutSpamSettings() {
        String id = publishedSurvey();
        for (int i = 0; i < 2; i++) {
            given().contentType(ContentType.JSON).header("X-Forwarded-For", "198.51.100.77")
                .body("{\"answers\":[]}")
                .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
        }
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "198.51.100.77")
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(429);
    }

    @Test
    @TestSecurity(user = "owner-busy")
    void draftSavesAreThrottledPerIp() {
        String id = publishedSurvey();
        for (int i = 0; i < 2; i++) {
            given().contentType(ContentType.JSON).header("X-Forwarded-For", "198.51.100.78")
                .body("{\"answers\":[]}")
                .when().post("/api/v1/public/surveys/" + id + "/drafts").then().statusCode(200);
        }
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "198.51.100.78")
            .body("{\"answers\":[]}")
            .when().post("/api/v1/public/surveys/" + id + "/drafts").then().statusCode(429);
    }
}
