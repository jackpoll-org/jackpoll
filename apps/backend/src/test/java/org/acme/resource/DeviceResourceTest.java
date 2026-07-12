package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Push device-token registration (mobile app). */
@QuarkusTest
class DeviceResourceTest {

    private static final String DEVICES = "/api/v1/me/devices";

    @Test
    void registrationRequiresAuth() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"token\":\"tok-1\",\"platform\":\"ios\"}")
            .when().post(DEVICES)
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void registersAndUnregistersAToken() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"token\":\"tok-abc\",\"platform\":\"ios\"}")
            .when().post(DEVICES)
            .then().statusCode(200)
            .body("data.registered", is(true));

        // Re-registering the same token is idempotent.
        given()
            .contentType(ContentType.JSON)
            .body("{\"token\":\"tok-abc\",\"platform\":\"android\"}")
            .when().post(DEVICES)
            .then().statusCode(200);

        given()
            .when().delete(DEVICES + "/tok-abc")
            .then().statusCode(204);
    }
}
