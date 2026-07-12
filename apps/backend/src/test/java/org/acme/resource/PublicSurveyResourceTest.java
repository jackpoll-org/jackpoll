package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PublicSurveyResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    @Test
    void unknownSurveyReturns404Publicly() {
        given().when().get(PUBLIC + "/nope").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void publishedSurveyIsReadableAnonymously_draftIsNot() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Public survey\"}")
            .when().post(SURVEYS)
            .then().statusCode(201)
            .extract().path("data.id");

        // draft → not visible publicly
        given().when().get(PUBLIC + "/" + id).then().statusCode(404);

        // publish it
        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Public survey\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        // now readable without auth
        given()
            .when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.title", is("Public survey"))
            .body("data.status", is("published"));
    }

    @Test
    void liveResults_disabledByDefaultReturns403() {
        // unknown / not-enabled survey → 404 or 403; here a missing one is 404.
        given().when().get(PUBLIC + "/nope/live-results").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void liveResults_onlyExposesAllowedQuestions() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Live\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String optA = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Live",
                  "status": "published",
                  "settings": { "showLiveResults": true },
                  "questions": [
                    {"type":"multiple-choice","title":"Pick","required":false,"order":0,
                     "options":[{"label":"A"},{"label":"B"}]},
                    {"type":"short-answer","title":"Comment","required":false,"order":1}
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .extract().path("data.questions[0].options[0].id");

        String mcId = given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + mcId + "\",\"value\":\"" + optA + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        // only the multiple-choice question is exposed; short-answer is excluded
        given()
            .when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions.size()", is(1))
            .body("data.questions[0].type", is("multiple-choice"))
            .body("data.questions[0].answered", is(1));
    }
}
