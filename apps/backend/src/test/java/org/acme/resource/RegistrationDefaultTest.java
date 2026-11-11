package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

@QuarkusTest
class RegistrationDefaultTest {

    @Test
    void registrationStaysOpenByDefault() {
        given().when().get("/api/v1/auth/oidc-config")
            .then().statusCode(200)
            .body("data.registrationEnabled", is(true));
    }
}
