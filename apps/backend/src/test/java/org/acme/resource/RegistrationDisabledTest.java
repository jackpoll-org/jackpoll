package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.acme.entity.EmailCode;
import org.acme.repository.UserRepository;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(RegistrationDisabledTest.Closed.class)
class RegistrationDisabledTest {

    public static class Closed implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("app.registration-enabled", "false");
        }
    }

    @Inject
    UserRepository users;

    @Test
    void sendsNoVerificationCodeToAPendingAccount() {
        String email = "pending-" + System.nanoTime() + "@example.org";
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(java.util.UUID.randomUUID().toString(), email, "Pending", false, null));

        given().contentType(ContentType.JSON)
            .body("{\"email\":\"" + email + "\"}")
            .when().post("/api/v1/auth/resend-verification")
            .then().statusCode(200);

        assertEquals(0L, QuarkusTransaction.requiringNew().call(() -> EmailCode.count("email", email)));
    }

    @Test
    void rejectsNewAccountsAndTellsTheFrontend() {
        given().contentType(ContentType.JSON)
            .body("{\"email\":\"new@example.org\",\"password\":\"Long-enough-1\",\"name\":\"New\",\"acceptedTerms\":true}")
            .when().post("/api/v1/auth/register")
            .then().statusCode(403)
            .body("success", is(false));

        given().when().get("/api/v1/auth/oidc-config")
            .then().statusCode(200)
            .body("data.registrationEnabled", is(false));

        given().contentType(ContentType.JSON)
            .body("{\"email\":\"pending@example.org\",\"code\":\"123456\"}")
            .when().post("/api/v1/auth/verify-email")
            .then().statusCode(400)
            .body("error", is("Registration is disabled on this instance."));
    }
}
