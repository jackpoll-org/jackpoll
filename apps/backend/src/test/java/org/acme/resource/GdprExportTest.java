package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.inject.Inject;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.Test;

/** Art. 15/20 export covers every category of data held about the user. */
@QuarkusTest
class GdprExportTest {

    @Inject
    UserRepository users;

    @Test
    @TestSecurity(user = "gdpr-export-user")
    void exportContainsEveryCategory() {
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert("gdpr-export-user", "gdpr-export@example.test", "Ada", true, null));
        given().contentType("application/json").body("{\"title\":\"Mine\"}")
            .when().post("/api/v1/surveys").then().statusCode(201);

        given().when().get("/api/v1/me/export")
            .then().statusCode(200)
            .body("$", hasKey("user"))
            .body("$", hasKey("surveys"))
            .body("$", hasKey("collaborations"))
            .body("$", hasKey("devices"))
            .body("$", hasKey("notificationPreferences"))
            .body("$", hasKey("notifications"))
            .body("user", hasKey("locale"))
            .body("surveys[0]", hasKey("webhooks"))
            .body("surveys[0].webhooks", not(hasKey("secret")));
    }
}
