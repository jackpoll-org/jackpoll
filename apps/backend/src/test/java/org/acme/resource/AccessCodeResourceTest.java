package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.acme.entity.AccessCode;
import org.acme.entity.ResponseDraft;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.acme.repository.AccessCodeRepository;
import org.acme.repository.ResponseDraftRepository;
import org.acme.repository.SurveyRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AccessCodeResourceTest {

    @ConfigProperty(name = "survey.access-code.rate-limit.max", defaultValue = "600")
    int accessCodeRateLimit;

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String ENTER = "/api/v1/public/access-code";

    @Test
    void accessCode_requiresAuth() {
        given().when().get(SURVEYS + "/x/access-code").then().statusCode(401);
    }

    @Test
    void resolve_unknownCodeReturns404() {
        given().contentType(ContentType.JSON).body("{\"code\":\"ZZZZZZZZ\"}")
            .when().post(ENTER).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void fullCodeLifecycle_caseInsensitiveAndRotation() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Coded\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Coded\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        String code = given()
            .when().get(SURVEYS + "/" + id + "/access-code")
            .then().statusCode(200)
            .body("data.code", notNullValue())
            .body("data.requireCode", is(false))
            .extract().path("data.code");

        // case-insensitive entry resolves to the survey
        given()
            .contentType(ContentType.JSON)
            .body("{\"code\":\"" + code.toLowerCase() + "\"}")
            .when().post(ENTER)
            .then().statusCode(200).body("data.survey.id", is(id)).body("data.accessToken", notNullValue());

        // rotate → old code no longer works
        String newCode = given()
            .when().post(SURVEYS + "/" + id + "/access-code/rotate")
            .then().statusCode(200).extract().path("data.code");
        Assertions.assertNotEquals(code, newCode);

        given()
            .contentType(ContentType.JSON)
            .body("{\"code\":\"" + code + "\"}")
            .when().post(ENTER)
            .then().statusCode(404);
    }

    @Inject
    SurveyRepository surveys;

    @Inject
    AccessCodeRepository codes;

    @Inject
    ResponseDraftRepository drafts;

    private String lockedSurvey(String code) {
        String id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = id;
            survey.ownerId = "locked-owner";
            survey.title = "Locked";
            survey.status = SurveyStatus.PUBLISHED;
            survey.settings = SurveySettings.defaults();
            surveys.persist(survey);
            var entity = new AccessCode();
            entity.id = UUID.randomUUID().toString();
            entity.surveyId = id;
            entity.code = code;
            entity.requireCode = true;
            codes.persist(entity);
        });
        return id;
    }

    /** With "require code" on, anonymous visitors need the token from a valid code. */
    @Test
    void requiredCode_locksPublicSurfacesUntilEnteredAndAfterRotation() {
        String code = "LK" + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        String id = lockedSurvey(code);

        given().when().get("/api/v1/public/surveys/" + id).then().statusCode(403);
        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);

        String token = given()
            .contentType(ContentType.JSON)
            .body("{\"code\":\"" + code + "\"}")
            .header("X-Forwarded-For", "198.51.100.20")
            .when().post(ENTER)
            .then().statusCode(200).extract().path("data.accessToken");
        given().header("X-Access-Token", token)
            .when().get("/api/v1/public/surveys/" + id).then().statusCode(200);

        QuarkusTransaction.requiringNew().run(() ->
            codes.update("code = ?1 where surveyId = ?2", code + "X", id));
        given().header("X-Access-Token", token)
            .when().get("/api/v1/public/surveys/" + id).then().statusCode(403);
    }

    /** A saved draft's resume link keeps working without re-entering the code. */
    @Test
    void requiredCode_acceptsTheDraftTokenOfThisSurvey() {
        String id = lockedSurvey("DR" + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase());
        String draftToken = UUID.randomUUID().toString().replace("-", "");
        QuarkusTransaction.requiringNew().run(() -> {
            var draft = new ResponseDraft();
            draft.id = UUID.randomUUID().toString();
            draft.token = draftToken;
            draft.surveyId = id;
            draft.answers = java.util.Map.of();
            draft.createdAt = Instant.now();
            draft.updatedAt = Instant.now();
            draft.expiresAt = Instant.now().plus(1, ChronoUnit.DAYS);
            drafts.persist(draft);
        });

        given().header("X-Resume-Token", draftToken)
            .when().get("/api/v1/public/surveys/" + id).then().statusCode(200);
        given().header("X-Resume-Token", "not-a-draft")
            .when().get("/api/v1/public/surveys/" + id).then().statusCode(403);
    }

    /** Owners and collaborators preview their own code-protected survey without the code. */
    @Test
    @TestSecurity(user = "owner-1")
    void requiredCode_letsMembersThrough() {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Mine\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Mine\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        given().contentType(ContentType.JSON).body("{\"requireCode\":true}")
            .when().put(SURVEYS + "/" + id + "/access-code")
            .then().statusCode(200);

        given().when().get("/api/v1/public/surveys/" + id).then().statusCode(200);
    }

    @Test
    void resolve_isRateLimitedPerIp() {
        int lastStatus = 0;
        for (int i = 0; i < accessCodeRateLimit + 2; i++) {
            lastStatus = given().contentType(ContentType.JSON).body("{\"code\":\"ZZZZZZZZ\"}")
                .header("X-Forwarded-For", "198.51.100.77")
                .when().post(ENTER).then().extract().statusCode();
        }
        Assertions.assertEquals(429, lastStatus);
    }
}
