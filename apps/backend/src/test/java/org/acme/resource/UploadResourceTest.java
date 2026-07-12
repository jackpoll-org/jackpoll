package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

/**
 * Integration tests for {@link UploadResource}. Requires the MinIO dev service
 * (docker compose: survey-minio) to be running, like the other resource tests
 * require PostgreSQL.
 */
@QuarkusTest
class UploadResourceTest {

    private static final String BASE = "/api/v1/uploads";

    // A minimal 1x1 transparent PNG.
    private static final byte[] PNG = java.util.Base64.getDecoder().decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    @Test
    void upload_requiresAuthentication() {
        given()
            .multiPart("file", "a.png", PNG, "image/png")
            .when().post(BASE)
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void upload_storesImageAndReturnsUrl() {
        given()
            .multiPart("file", "photo.png", PNG, "image/png")
            .when().post(BASE)
            .then()
            .statusCode(201)
            .body("success", is(true))
            .body("data.key", startsWith("uploads/"))
            .body("data.url", notNullValue())
            .body("data.contentType", is("image/png"));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void upload_rejectsNonImage() {
        given()
            .multiPart("file", "notes.txt", "hello".getBytes(), "text/plain")
            .when().post(BASE)
            .then()
            .statusCode(400)
            .body("success", is(false));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void upload_rejectsSpoofedContentType() {
        // Text bytes disguised with an image content-type and .png name (#43):
        // content sniffing must reject it regardless of the declared header.
        given()
            .multiPart("file", "evil.png", "not really a png".getBytes(), "image/png")
            .when().post(BASE)
            .then()
            .statusCode(400)
            .body("success", is(false));
    }
}
