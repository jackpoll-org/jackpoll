package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.hasItem;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.not;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.startsWith;

import java.time.Instant;

import org.acme.entity.User;
import org.acme.repository.UserRepository;
import org.acme.service.ApiKeyService;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@QuarkusTest
class ApiKeyTest {

    private static final String API = "/api/v1";

    @Inject
    ApiKeyService apiKeys;

    @Inject
    UserRepository users;

    private String keyFor(String userId, boolean readResponses) {
        return createKey(userId, readResponses).secret();
    }

    private org.acme.dto.ApiKeyDtos.CreatedApiKeyDto createKey(String userId, boolean readResponses) {
        ensureUser(userId);
        return apiKeys.create(userId, "Agent", readResponses);
    }

    @Transactional
    void ensureUser(String userId) {
        if (users.findByIdOptional(userId).isPresent()) return;
        var user = new User();
        user.id = userId;
        user.email = userId + "@example.com";
        user.name = userId;
        user.emailVerified = true;
        user.createdAt = Instant.now();
        user.updatedAt = Instant.now();
        users.persist(user);
    }

    @Transactional
    void deleteUser(String userId) {
        users.deleteById(userId);
    }

    @Test
    @TestSecurity(user = "key-owner")
    void ownerCreatesListsAndRevokesKeys() {
        String id = given().contentType(ContentType.JSON).body("{\"name\":\"  Claude  \",\"readResponses\":true}")
            .when().post(API + "/me/api-keys")
            .then().statusCode(201)
            .body("data.secret", startsWith("jp_"))
            .body("data.apiKey.name", is("Claude"))
            .body("data.apiKey.scopes", hasItem("responses"))
            .extract().path("data.apiKey.id");

        given().when().get(API + "/me/api-keys")
            .then().statusCode(200)
            .body("data[0].id", is(id))
            .body("data[0]", not(hasKey("secret")))
            .body("data[0].prefix", startsWith("jp_"));

        given().when().delete(API + "/me/api-keys/" + id).then().statusCode(200);
        given().when().delete(API + "/me/api-keys/" + id).then().statusCode(404);
        given().contentType(ContentType.JSON).body("{\"name\":\"\"}")
            .when().post(API + "/me/api-keys").then().statusCode(422);
    }

    @Test
    void keyManagesSurveysAsItsOwner() {
        String key = keyFor("agent-user", false);
        String id = given().auth().oauth2(key).contentType(ContentType.JSON)
            .body("{\"title\":\"From an agent\"}")
            .when().post(API + "/surveys")
            .then().statusCode(201)
            .body("data.ownerId", is("agent-user"))
            .extract().path("data.id");

        given().auth().oauth2(key).contentType(ContentType.JSON)
            .body("""
                {"title":"From an agent","status":"draft","settings":{"allowMultipleResponses":true},
                 "questions":[{"id":"q1","type":"short-answer","title":"Name?","required":true,"order":0}]}
                """)
            .when().put(API + "/surveys/" + id)
            .then().statusCode(200)
            .body("data.questions[0].title", is("Name?"));

        given().auth().oauth2(key).when().get(API + "/surveys/" + id + "/responses")
            .then().statusCode(403);
        given().auth().oauth2(key).when().get(API + "/me/api-keys")
            .then().statusCode(403);
        given().auth().oauth2(key).contentType(ContentType.JSON).body("{\"name\":\"Escalate\"}")
            .when().post(API + "/me/api-keys")
            .then().statusCode(403);
    }

    @Test
    void responsesScopeOnlyReads() {
        String key = keyFor("agent-reader", true);
        String id = given().auth().oauth2(key).contentType(ContentType.JSON)
            .body("{\"title\":\"Readable\"}")
            .when().post(API + "/surveys")
            .then().statusCode(201).extract().path("data.id");

        given().auth().oauth2(key).when().get(API + "/surveys/" + id + "/responses")
            .then().statusCode(200);
        given().auth().oauth2(key).when().delete(API + "/surveys/" + id + "/responses")
            .then().statusCode(403);
    }

    @Test
    void unknownOrRevokedKeysAreRejected() {
        given().auth().oauth2("jp_not-a-real-key").when().get(API + "/surveys")
            .then().statusCode(401);

        var created = createKey("agent-revoked", false);
        given().auth().oauth2(created.secret()).when().get(API + "/surveys").then().statusCode(200);
        apiKeys.delete("agent-revoked", created.apiKey().id());
        given().auth().oauth2(created.secret()).when().get(API + "/surveys").then().statusCode(401);
    }

    @Test
    void anotherUsersKeyCannotOpenTheSurvey() {
        String id = given().auth().oauth2(keyFor("agent-a", false)).contentType(ContentType.JSON)
            .body("{\"title\":\"Private\"}")
            .when().post(API + "/surveys")
            .then().statusCode(201).extract().path("data.id");

        given().auth().oauth2(keyFor("agent-b", false)).when().get(API + "/surveys/" + id)
            .then().statusCode(404);
    }

    @Test
    void publishesAnOpenApiSpecForTheProxiedApi() {
        given().queryParam("format", "json").when().get(API + "/openapi")
            .then().statusCode(200)
            .body("servers[0].url", is("/api"))
            .body("paths", hasKey("/surveys"))
            .body("paths", not(hasKey("/api/v1/surveys")))
            .body("paths", not(hasKey("/me/api-keys")))
            .body("paths", not(hasKey("/auth/login")))
            .body("components.securitySchemes.apiKey.scheme", is("bearer"))
            .body("info.title", is("Jackpoll API"));
    }

    @Test
    void surveysOnlyKeyCannotShareResultsOrDeleteResponses() {
        String key = keyFor("agent-limited", false);
        String id = given().auth().oauth2(key).contentType(ContentType.JSON)
            .body("{\"title\":\"Guarded\"}")
            .when().post(API + "/surveys")
            .then().statusCode(201).extract().path("data.id");
        String body = """
            {"title":"Guarded","status":"published","settings":{"allowMultipleResponses":true%s},
             "questions":[{"id":"g1","type":"short-answer","title":"Q","required":false,"order":0}]}
            """;

        given().auth().oauth2(key).contentType(ContentType.JSON).body(body.formatted(""))
            .when().put(API + "/surveys/" + id).then().statusCode(200);
        given().auth().oauth2(key).contentType(ContentType.JSON).body(body.formatted(",\"showLiveResults\":true"))
            .when().put(API + "/surveys/" + id).then().statusCode(403);
        given().auth().oauth2(key).contentType(ContentType.JSON).body(body.formatted(",\"retentionDays\":1"))
            .when().put(API + "/surveys/" + id).then().statusCode(403);

        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"g1\",\"value\":\"hi\"}]}")
            .when().post(API + "/surveys/" + id + "/responses").then().statusCode(201);
        given().auth().oauth2(key).when().delete(API + "/surveys/" + id).then().statusCode(403);

        String fullKey = keyFor("agent-limited", true);
        given().auth().oauth2(fullKey).contentType(ContentType.JSON).body(body.formatted(",\"showLiveResults\":true"))
            .when().put(API + "/surveys/" + id).then().statusCode(200);
        given().auth().oauth2(fullKey).when().delete(API + "/surveys/" + id).then().statusCode(200);
    }

    @Test
    void keysStopWorkingWhenTheAccountIsGone() {
        String key = keyFor("agent-deleted-user", false);
        given().auth().oauth2(key).when().get(API + "/surveys").then().statusCode(200);
        deleteUser("agent-deleted-user");
        given().auth().oauth2(key).when().get(API + "/surveys").then().statusCode(401);
    }

    @Test
    void keysOnlyWorkOnTheRestApi() {
        String key = keyFor("agent-scheme", false);
        given().header("Authorization", "bearer " + key).when().get(API + "/surveys").then().statusCode(200);
        given().auth().oauth2(key).when().get("/q/health").then().statusCode(org.hamcrest.Matchers.not(200));
        given().auth().oauth2(key).when().get(API + "/public/surveys/x/begin").then().statusCode(403);
    }

    @Test
    void keysAreRemovedWithTheUsersData() {
        var created = createKey("agent-gone", false);
        apiKeys.deleteAllForUser("agent-gone");
        given().auth().oauth2(created.secret()).when().get(API + "/surveys").then().statusCode(401);
        org.junit.jupiter.api.Assertions.assertEquals(0, apiKeys.list("agent-gone").size());
        org.hamcrest.MatcherAssert.assertThat(created.apiKey().lastUsedAt(), nullValue());
    }
}
