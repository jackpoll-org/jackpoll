package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CollabLinkResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String COLLAB = "/api/v1/public/collab";

    @Test
    void collabLink_requiresAuth() {
        given().when().get(SURVEYS + "/x/collab-link").then().statusCode(401);
    }

    @Test
    void resolve_unknownSlugReturns404() {
        given().when().get(COLLAB + "/nope").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void anonymousCollaboratorCanEditViaLink() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Shared edit\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        // No link exists until the owner asks for one.
        given().when().get(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(200).body("data.slug", nullValue());

        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200)
            .body("data.slug", notNullValue())
            .extract().path("data.slug");

        // anonymous resolve returns the editable survey
        given().when().get(COLLAB + "/" + slug)
            .then().statusCode(200).body("data.id", is(id));

        // anonymous edit via the link
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Edited by collaborator",
                  "status": "draft",
                  "questions": [
                    {"type":"short-answer","title":"Added","required":false,"order":0}
                  ]
                }
                """)
            .when().put(COLLAB + "/" + slug)
            .then().statusCode(200)
            .body("data.title", is("Edited by collaborator"))
            .body("data.questions.size()", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void expiredLinkRejectsAccess() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Expiring\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        given()
            .contentType(ContentType.JSON)
            .body("{\"expiresAt\":\"2020-01-01T00:00:00Z\"}")
            .when().put(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(200);

        given().when().get(COLLAB + "/" + slug).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void disabledLinkStopsWorking_andMalformedExpiryIsRejected() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Revocable\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        given().contentType(ContentType.JSON).body("{\"expiresAt\":\"tomorrow\"}")
            .when().put(SURVEYS + "/" + id + "/collab-link")
            .then().statusCode(400);

        given().when().delete(SURVEYS + "/" + id + "/collab-link").then().statusCode(204);
        given().when().get(COLLAB + "/" + slug).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void linkHolderCannotChangeOwnerOnlySettings() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Owner settings\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Owner settings\",\"status\":\"draft\",\"settings\":{\"retentionDays\":30}}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Owner settings","status":"draft",
                 "settings":{"retentionDays":1,"retentionAnonymize":true,"ogShowOwner":true,
                   "showLiveResults":true,"postSubmitSummary":true,"postSubmitCombinedWordcloud":true,
                   "resultsReleased":true}}
                """)
            .when().put(COLLAB + "/" + slug)
            .then().statusCode(200);

        given().when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.settings.retentionDays", is(30))
            .body("data.settings.retentionAnonymize", is(false))
            .body("data.settings.ogShowOwner", nullValue())
            .body("data.settings.showLiveResults", is(false))
            .body("data.settings.postSubmitSummary", is(false))
            .body("data.settings.postSubmitCombinedWordcloud", is(false))
            .body("data.settings.resultsReleased", is(false));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void linkHolderCannotWidenQuestionResultSharing() {
        String q1 = java.util.UUID.randomUUID().toString();
        String q2 = java.util.UUID.randomUUID().toString();
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Question sharing\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Question sharing","status":"draft",
                 "settings":{"postSubmitCombinedWordcloud":true},
                 "questions":[{"id":"%s","type":"multiple-choice","title":"Pick","required":false,"order":0,
                   "showInLiveResults":false,"settings":{"resultChart":"pie"},"options":[{"label":"A"}]}]}
                """.formatted(q1))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Question sharing","status":"draft",
                 "settings":{"postSubmitCombinedWordcloud":true},
                 "questions":[
                   {"id":"%s","type":"multiple-choice","title":"Pick renamed","required":false,"order":0,
                    "showInLiveResults":true,"settings":{"resultChart":"wordcloud"},"options":[{"label":"A"}]},
                   {"id":"%s","type":"dropdown","title":"New","required":false,"order":1,
                    "settings":{"resultChart":"wordcloud"},"options":[{"label":"B"}]}]}
                """.formatted(q1, q2))
            .when().put(COLLAB + "/" + slug)
            .then().statusCode(200);

        given().when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].title", is("Pick renamed"))
            .body("data.questions[0].showInLiveResults", is(false))
            .body("data.questions[0].settings.resultChart", is("pie"))
            .body("data.questions[1].title", is("New"))
            .body("data.questions[1].settings.resultChart", nullValue());
    }

    @Test
    @TestSecurity(user = "owner-1")
    void linkHolderCanStillNarrowQuestionResultSharing() {
        String q1 = java.util.UUID.randomUUID().toString();
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Narrow sharing\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Narrow sharing","status":"draft",
                 "questions":[{"id":"%s","type":"multiple-choice","title":"Pick","required":false,"order":0,
                   "settings":{"resultChart":"wordcloud"},"options":[{"label":"A"}]}]}
                """.formatted(q1))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Narrow sharing","status":"draft",
                 "questions":[{"id":"%s","type":"multiple-choice","title":"Pick","required":false,"order":0,
                   "showInLiveResults":false,"settings":{"resultChart":"bar"},"options":[{"label":"A"}]}]}
                """.formatted(q1))
            .when().put(COLLAB + "/" + slug)
            .then().statusCode(200);

        given().when().get(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].showInLiveResults", is(false))
            .body("data.questions[0].settings.resultChart", is("bar"));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void linkHolderCanPreviewTheSurveyTheLinkEdits() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Preview via link\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String slug = given()
            .when().post(SURVEYS + "/" + id + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");

        io.restassured.RestAssured.given().auth().none()
            .contentType(ContentType.JSON)
            .header("X-Collab-Link", slug)
            .body("{\"preview\":true,\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);
    }
}
