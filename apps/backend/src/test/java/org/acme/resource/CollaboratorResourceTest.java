package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CollaboratorResourceTest {

    private static final String BASE = "/api/v1/surveys";

    @Test
    void list_requiresAuthentication() {
        given().when().get(BASE + "/whatever/collaborators").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void newSurveyHasNoCollaborators_andUnknownEmailIsRejected() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Team survey\"}")
            .when().post(BASE)
            .then().statusCode(201)
            .extract().path("data.id");

        given()
            .when().get(BASE + "/" + id + "/collaborators")
            .then().statusCode(200).body("data.size()", is(0));

        // Inviting an email with no account returns 404.
        given()
            .contentType(ContentType.JSON)
            .body("{\"email\":\"nobody@example.com\",\"role\":\"editor\"}")
            .when().post(BASE + "/" + id + "/collaborators")
            .then().statusCode(404).body("success", is(false));
    }

    @Test
    @TestSecurity(user = "owner-2")
    void managingCollaboratorsOnUnknownSurveyReturns404() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"email\":\"x@example.com\",\"role\":\"viewer\"}")
            .when().post(BASE + "/does-not-exist/collaborators")
            .then().statusCode(404);
    }
}
