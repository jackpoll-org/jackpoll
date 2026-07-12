package org.acme.resource;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

/** GDPR export + account-deletion endpoints require authentication. */
@QuarkusTest
class GdprEndpointsTest {

    @Test
    void exportRequiresAuth() {
        given().when().get("/api/v1/me/export").then().statusCode(401);
    }

    @Test
    void deleteAccountRequiresAuth() {
        given().when().delete("/api/v1/me").then().statusCode(401);
    }
}
