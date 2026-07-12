package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Edit-after-submission flow (issue #40). */
@QuarkusTest
class EditResponseTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String EDIT = "/api/v1/public/responses";

    @Test
    @TestSecurity(user = "owner-1")
    void editUpdatesInPlaceWithoutDoubleCounting() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Editable\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Editable", "status": "published",
                  "settings": { "allowEditResponses": true },
                  "questions": [{"type":"short-answer","title":"Name","required":false,"order":0}]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.settings.allowEditResponses", is(true))
            .extract().path("data.questions[0].id");

        // submit → response carries an edit token
        String token = given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"Alice\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201)
            .body("data.editToken", notNullValue())
            .extract().path("data.editToken");

        // re-open for editing → restores answers + survey id
        given()
            .when().get(EDIT + "/" + token)
            .then().statusCode(200)
            .body("data.surveyId", is(id))
            .body("data.response.answers[0].value", is("Alice"));

        // edit in place
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"Bob\"}]}")
            .when().put(EDIT + "/" + token)
            .then().statusCode(200)
            .body("data.editedAt", notNullValue())
            .body("data.answers[0].value", is("Bob"));

        // results still show exactly ONE response (no double count)
        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.totalResponses", is(1));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void noTokenWhenEditingDisabled_andUnknownTokenIs404() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"NoEdit\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"NoEdit\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201)
            .body("data.editToken", nullValue());

        given().when().get(EDIT + "/does-not-exist").then().statusCode(404);
    }
}
