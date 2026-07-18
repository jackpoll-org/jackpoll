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
    void get_returnsAllOnDefaultsForEveryEvent() {
        given().when().get(PREFS)
            .then().statusCode(200)
            .body("data.byEvent.new_response.email", is(true))
            .body("data.byEvent.new_response.mobile_push", is(true))
            .body("data.byEvent.new_response.web_push", is(true))
            .body("data.byEvent.new_response.in_app", is(true))
            .body("data.byEvent.daily_digest.email", is(true))
            .body("data.byEvent.daily_digest.mobile_push", is((Object) null))
            .body("data.byEvent.collaborator_invited.email", is(true))
            .body("data.byEvent.collaborator_accepted.in_app", is(true))
            .body("data.byEvent.collaborator_declined.web_push", is(true))
            .body("data.byEvent.collaborator_removed.mobile_push", is(true))
            .body("data.byEvent.response_milestone.email", is(true))
            .body("data.byEvent.survey_auto_closed.email", is(true))
            .body("data.byEvent.webhook_failing.email", is(true));
    }

    @Test
    @TestSecurity(user = "owner-prefs-update")
    void put_updatesAndRoundTrips() {
        seedUser("owner-prefs-update");

        given()
            .contentType(ContentType.JSON)
            .body("{\"byEvent\":{"
                + "\"new_response\":{\"email\":false,\"mobile_push\":true,\"web_push\":false,\"in_app\":true},"
                + "\"daily_digest\":{\"email\":false},"
                + "\"collaborator_invited\":{\"email\":true,\"mobile_push\":false,\"web_push\":true,\"in_app\":true}"
                + "}}")
            .when().put(PREFS)
            .then().statusCode(200)
            .body("data.byEvent.new_response.email", is(false))
            .body("data.byEvent.new_response.mobile_push", is(true))
            .body("data.byEvent.new_response.web_push", is(false))
            .body("data.byEvent.daily_digest.email", is(false))
            .body("data.byEvent.collaborator_invited.mobile_push", is(false));

        given().when().get(PREFS)
            .then().statusCode(200)
            .body("data.byEvent.new_response.email", is(false))
            .body("data.byEvent.daily_digest.email", is(false))
            .body("data.byEvent.collaborator_invited.mobile_push", is(false))
            // Untouched events keep their all-on default.
            .body("data.byEvent.response_milestone.email", is(true));
    }

    @Test
    @TestSecurity(user = "owner-prefs-invalid")
    void put_rejectsUnknownEventKey() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"byEvent\":{\"not_a_real_event\":{\"email\":false}}}")
            .when().put(PREFS)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "owner-prefs-invalid-channel")
    void put_rejectsNonEmailChannelForDailyDigest() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"byEvent\":{\"daily_digest\":{\"mobile_push\":false}}}")
            .when().put(PREFS)
            .then().statusCode(400);
    }
}
