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
class ShareLinkResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String LINKS = "/api/v1/public/links";

    @Test
    void shareLink_requiresAuth() {
        given().when().get(SURVEYS + "/x/share-link").then().statusCode(401);
    }

    @Test
    void resolve_unknownSlugReturns404() {
        given().when().get(LINKS + "/nope").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void fullLinkLifecycle_resolveRotateAndResponseCap() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Shareable\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        // publish
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Shareable\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        // get (auto-creates) the link
        String slug = given()
            .when().get(SURVEYS + "/" + id + "/share-link")
            .then().statusCode(200)
            .body("data.slug", notNullValue())
            .extract().path("data.slug");

        // public resolve works
        given().when().get(LINKS + "/" + slug)
            .then().statusCode(200).body("data.id", is(id));

        // cap the link at 1 response
        given()
            .contentType(ContentType.JSON)
            .body("{\"maxResponses\":1}")
            .when().put(SURVEYS + "/" + id + "/share-link")
            .then().statusCode(200);

        // first submission ok, second rejected by the cap
        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);

        // resolve now reports the link as closed
        given().when().get(LINKS + "/" + slug).then().statusCode(403);

        // rotate → new slug, old one stops resolving
        String newSlug = given()
            .when().post(SURVEYS + "/" + id + "/share-link/rotate")
            .then().statusCode(200).extract().path("data.slug");
        given().when().get(LINKS + "/" + slug).then().statusCode(404);
        Assertions.assertNotEquals(slug, newSlug);
    }
}
