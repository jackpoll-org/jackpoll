package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasSize;

import java.time.Instant;
import java.util.UUID;

import org.acme.entity.Notification;
import org.acme.entity.User;
import org.acme.repository.NotificationRepository;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;

@QuarkusTest
class NotificationsResourceTest {

    private static final String BASE = "/api/v1/notifications";

    @Inject
    UserRepository users;

    @Inject
    NotificationRepository notifications;

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

    private String seedNotification(String userId, boolean read) {
        var id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var n = new Notification();
            n.id = id;
            n.userId = userId;
            n.eventType = "new_response";
            n.title = "Test notification";
            n.body = "body";
            n.link = "/surveys/x/results";
            n.readAt = read ? Instant.now() : null;
            n.createdAt = Instant.now();
            notifications.persist(n);
        });
        return id;
    }

    @Test
    void list_requiresAuth() {
        given().when().get(BASE).then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "notif-new-user")
    void list_returnsEmptyForNewUser() {
        seedUser("notif-new-user");
        given().when().get(BASE)
            .then().statusCode(200)
            .body("data", hasSize(0));
    }

    @Test
    @TestSecurity(user = "notif-unread-user")
    void unreadCount_reflectsOnlyUnreadRows() {
        seedUser("notif-unread-user");
        seedNotification("notif-unread-user", true);
        seedNotification("notif-unread-user", false);
        seedNotification("notif-unread-user", false);

        given().when().get(BASE + "/unread-count")
            .then().statusCode(200)
            .body("data.count", is(2));
    }

    @Test
    @TestSecurity(user = "notif-markread-user")
    void markRead_setsReadAt_andExcludesFromUnreadCount() {
        seedUser("notif-markread-user");
        var id = seedNotification("notif-markread-user", false);

        given().when().put(BASE + "/" + id + "/read")
            .then().statusCode(200);

        given().when().get(BASE + "/unread-count")
            .then().statusCode(200)
            .body("data.count", is(0));
    }

    @Test
    @TestSecurity(user = "notif-markread-unknown")
    void markRead_unknownId_returns404() {
        seedUser("notif-markread-unknown");
        given().when().put(BASE + "/" + UUID.randomUUID() + "/read")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "notif-markread-otheruser")
    void markRead_otherUsersNotification_returns404() {
        seedUser("notif-markread-otheruser");
        seedUser("notif-markread-victim");
        var victimNotificationId = seedNotification("notif-markread-victim", false);

        given().when().put(BASE + "/" + victimNotificationId + "/read")
            .then().statusCode(404);

        given().when().get(BASE + "/unread-count")
            .then().statusCode(200)
            .body("data.count", is(0)); // the requester's own count, unaffected
    }

    @Test
    @TestSecurity(user = "notif-markallread-user")
    void markAllRead_marksAllUnread() {
        seedUser("notif-markallread-user");
        seedNotification("notif-markallread-user", false);
        seedNotification("notif-markallread-user", false);

        given().when().put(BASE + "/read-all")
            .then().statusCode(200);

        given().when().get(BASE + "/unread-count")
            .then().statusCode(200)
            .body("data.count", is(0));
    }
}
