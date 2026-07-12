package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CollabLinkResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String COLLAB = "/api/v1/public/collab";

    @Test
    void collabLink_requiresAuth() {
        given().when().get(SURVEYS + "/x/collab-link").then().statusCode(401);
    }

    @Test
    void resolve_unknownSlugReturns404() {
        given().when().get(COLLAB + "/nope").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void anonymousCollaboratorCanEditViaLink() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Shared edit\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String slug = given()
            .when().get(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(200)
            .body("data.slug", notNullValue())
            .extract().path("data.slug");

        // anonymous resolve returns the editable survey
        given().when().get(COLLAB + "/" + slug)
            .then().statusCode(200).body("data.id", is(id));

        // anonymous edit via the link
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Edited by collaborator",
                  "status": "draft",
                  "questions": [
                    {"type":"short-answer","title":"Added","required":false,"order":0}
                  ]
                }
                """)
            .when().put(COLLAB + "/" + slug)
            .then().statusCode(200)
            .body("data.title", is("Edited by collaborator"))
            .body("data.questions.size()", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void expiredLinkRejectsAccess() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Expiring\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String slug = given()
            .when().get(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(200).extract().path("data.slug");

        given()
            .contentType(ContentType.JSON)
            .body("{\"expiresAt\":\"2020-01-01T00:00:00Z\"}")
            .when().put(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(200);

        given().when().get(COLLAB + "/" + slug).then().statusCode(403);
    }
}
