package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.time.Instant;

import org.acme.entity.User;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;

@QuarkusTest
class NotificationPrefsResourceTest {

    private static final String PREFS = "/api/v1/notification-preferences";

    @Inject
    UserRepository users;

    private void seedUser(String id) {
        QuarkusTransaction.requiringNew().run(() -> {
            if (users.findByIdOptional(id).isEmpty()) {
                var u = new User();
                u.id = id;
                u.email = id + "@example.com";
                u.name = "Test " + id;
                u.emailVerified = true;
                u.createdAt = Instant.now();
                u.updatedAt = Instant.now();
                users.persist(u);
            }
        });
    }

    @Test
    void prefs_requireAuth() {
        given().when().get(PREFS).then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-prefs-default")
    void get_returnsDefaultsWhenNoRow() {
        given().when().get(PREFS)
            .then().statusCode(200)
            .body("data.newResponse.email", is(true))
            .body("data.newResponse.mobilePush", is(true))
            .body("data.newResponse.webPush", is(true))
            .body("data.dailyDigest.email", is(true));
    }

    @Test
    @TestSecurity(user = "owner-prefs-update")
    void put_updatesAndRoundTrips() {
        seedUser("owner-prefs-update");

        given()
            .contentType(ContentType.JSON)
            .body("{\"newResponse\":{\"email\":false,\"mobilePush\":true,\"webPush\":false},"
                + "\"dailyDigest\":{\"email\":false}}")
            .when().put(PREFS)
            .then().statusCode(200)
            .body("data.newResponse.email", is(false))
            .body("data.newResponse.mobilePush", is(true))
            .body("data.newResponse.webPush", is(false))
            .body("data.dailyDigest.email", is(false));

        given().when().get(PREFS)
            .then().statusCode(200)
            .body("data.newResponse.email", is(false))
            .body("data.newResponse.webPush", is(false))
            .body("data.dailyDigest.email", is(false));
    }
}
