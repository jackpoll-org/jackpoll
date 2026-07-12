package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AccessCodeResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String ENTER = "/api/v1/public/access-code";

    @Test
    void accessCode_requiresAuth() {
        given().when().get(SURVEYS + "/x/access-code").then().statusCode(401);
    }

    @Test
    void resolve_unknownCodeReturns404() {
        given().contentType(ContentType.JSON).body("{\"code\":\"ZZZZZZZZ\"}")
            .when().post(ENTER).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void fullCodeLifecycle_caseInsensitiveAndRotation() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Coded\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Coded\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        String code = given()
            .when().get(SURVEYS + "/" + id + "/access-code")
            .then().statusCode(200)
            .body("data.code", notNullValue())
            .body("data.requireCode", is(false))
            .extract().path("data.code");

        // case-insensitive entry resolves to the survey
        given()
            .contentType(ContentType.JSON)
            .body("{\"code\":\"" + code.toLowerCase() + "\"}")
            .when().post(ENTER)
            .then().statusCode(200).body("data.id", is(id));

        // rotate → old code no longer works
        String newCode = given()
            .when().post(SURVEYS + "/" + id + "/access-code/rotate")
            .then().statusCode(200).extract().path("data.code");
        Assertions.assertNotEquals(code, newCode);

        given()
            .contentType(ContentType.JSON)
            .body("{\"code\":\"" + code + "\"}")
            .when().post(ENTER)
            .then().statusCode(404);
    }
}
