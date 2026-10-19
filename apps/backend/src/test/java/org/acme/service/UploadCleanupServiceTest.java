package org.acme.service;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

@QuarkusTest
class UploadCleanupServiceTest {

    private static final byte[] PNG = Base64.getDecoder().decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    @Inject
    UploadCleanupService cleanup;

    @Inject
    StorageService storage;

    @Test
    @TestSecurity(user = "upload-cleanup-owner")
    void deletesOnlyUnreferencedUploads() {
        var orphan = storage.upload("orphan.png", "image/png", new ByteArrayInputStream(PNG), PNG.length);
        var logo = storage.upload("logo.png", "image/png", new ByteArrayInputStream(PNG), PNG.length);
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"With logo\"}")
            .when().post("/api/v1/surveys")
            .then().statusCode(201).extract().path("data.id");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"With logo\",\"status\":\"draft\",\"questions\":[],"
                + "\"settings\":{\"logoUrl\":\"" + logo.url() + "\"}}")
            .when().put("/api/v1/surveys/" + id)
            .then().statusCode(200).body("data.settings.logoUrl", org.hamcrest.Matchers.is(logo.url()));

        cleanup.sweep(Instant.now().plusSeconds(60));

        var remaining = storage.uploads().map(StorageService.StoredObject::key).toList();
        assertFalse(remaining.contains(orphan.key()), "unreferenced upload is deleted");
        assertTrue(remaining.contains(logo.key()), "upload referenced by a survey is kept");
    }
}
