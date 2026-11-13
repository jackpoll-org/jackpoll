package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.Matchers.everyItem;

import java.util.UUID;

import org.acme.entity.User;
import org.acme.repository.UserRepository;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CollaboratorResourceTest {

    private static final String BASE = "/api/v1/surveys";

    @Inject
    UserRepository users;

    private static String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Team survey\"}")
            .when().post(BASE)
            .then().statusCode(201)
            .extract().path("data.id");
    }

    private static void invite(String surveyId, String email) {
        given()
            .contentType(ContentType.JSON)
            .body("{\"email\":\"" + email + "\",\"role\":\"editor\"}")
            .when().post(BASE + "/" + surveyId + "/collaborators")
            .then().statusCode(201)
            .body("data.userId", nullValue()).body("data.name", nullValue())
            .body("data.email", is(email)).body("data.status", is("PENDING"));
    }

    @Test
    void list_requiresAuthentication() {
        given().when().get(BASE + "/whatever/collaborators").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void newSurveyHasNoCollaborators_andUnknownEmailLooksLikeAnInvite() {
        String id = createSurvey();

        given()
            .when().get(BASE + "/" + id + "/collaborators")
            .then().statusCode(200).body("data.size()", is(0));

        given()
            .contentType(ContentType.JSON)
            .body("{\"email\":\"nobody@example.com\",\"role\":\"editor\"}")
            .when().post(BASE + "/" + id + "/collaborators")
            .then().statusCode(201).body("success", is(true))
            .body("data.userId", nullValue()).body("data.status", is("PENDING"));

        given()
            .when().get(BASE + "/" + id + "/collaborators")
            .then().statusCode(200).body("data.size()", is(1))
            .body("data[0].email", is("nobody@example.com"))
            .body("data[0].userId", nullValue())
            .body("data[0].name", nullValue())
            .body("data[0].status", is("PENDING"));
    }

    @Test
    @TestSecurity(user = "owner-3")
    void knownAndUnknownInvitesLookTheSameToTheOwner() {
        String known = "known-" + UUID.randomUUID() + "@example.com";
        String unknown = "unknown-" + UUID.randomUUID() + "@example.com";
        QuarkusTransaction.requiringNew().run(() -> {
            var u = new User();
            u.id = UUID.randomUUID().toString();
            u.email = known;
            u.name = "Known";
            u.emailVerified = true;
            users.persist(u);
        });
        String id = createSurvey();

        invite(id, known);
        invite(id, unknown);
        invite(id, known);
        invite(id, unknown);

        given()
            .when().get(BASE + "/" + id + "/collaborators")
            .then().statusCode(200).body("data.size()", is(2))
            .body("data.userId", everyItem(nullValue()))
            .body("data.name", everyItem(nullValue()))
            .body("data.status", everyItem(is("PENDING")));

        given().when().delete(BASE + "/" + id + "/collaborators/" + unknown).then().statusCode(200);
        given()
            .when().get(BASE + "/" + id + "/collaborators")
            .then().statusCode(200).body("data.size()", is(1)).body("data[0].email", is(known));
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
