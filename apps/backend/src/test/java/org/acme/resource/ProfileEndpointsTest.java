package org.acme.resource;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Profile + password endpoints require authentication. */
@QuarkusTest
class ProfileEndpointsTest {

    @Test
    void updateProfileRequiresAuth() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"name\":\"New Name\"}")
            .when().put("/api/v1/auth/profile")
            .then().statusCode(401);
    }

    @Test
    void changePasswordRequiresAuth() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"currentPassword\":\"old\",\"newPassword\":\"NewPass123\"}")
            .when().post("/api/v1/auth/change-password")
            .then().statusCode(401);
    }
}
