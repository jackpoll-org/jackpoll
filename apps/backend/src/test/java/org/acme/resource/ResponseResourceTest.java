package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasItem;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ResponseResourceTest {

    private static final String BASE = "/api/v1/surveys";

    @Test
    void submit_isPublic_andUnknownSurveyReturns404() {
        // No @TestSecurity: a 404 (not 401) proves the endpoint is reachable anonymously.
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(BASE + "/does-not-exist/responses")
            .then().statusCode(404);
    }

    @Test
    void submit_rejectsOversizedAnswerList_withoutTouchingTheDatabase() {
        // Bean Validation (@Size(max=1000) on answers) runs before the resource
        // body, so an abusive anonymous payload is rejected up front with the 422
        // that ValidationExceptionMapper gives every constraint violation — it
        // never reaches the survey lookup, which would have answered 404.
        StringBuilder answers = new StringBuilder("[");
        for (int i = 0; i < 1001; i++) {
            if (i > 0) answers.append(',');
            answers.append("{\"questionId\":\"q").append(i).append("\",\"value\":\"x\"}");
        }
        answers.append(']');

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":" + answers + "}")
            .when().post(BASE + "/does-not-exist/responses")
            .then().statusCode(422);
    }

    @Test
    void results_requireAuthentication() {
        given()
            .when().get(BASE + "/whatever/results")
            .then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void deleteAndClearResponses() {
        String surveyId = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Managed\"}")
            .when().post(BASE)
            .then().statusCode(201).extract().path("data.id");

        String questionId = given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Managed","status":"published",
                 "questions":[{"type":"short-answer","title":"Name","required":false,"order":0}]}
                """)
            .when().put(BASE + "/" + surveyId)
            .then().statusCode(200).extract().path("data.questions[0].id");

        for (String name : new String[] {"A", "B"}) {
            given().contentType(ContentType.JSON)
                .body("{\"answers\":[{\"questionId\":\"" + questionId + "\",\"value\":\"" + name + "\"}]}")
                .when().post(BASE + "/" + surveyId + "/responses").then().statusCode(201);
        }

        String firstId = given().when().get(BASE + "/" + surveyId + "/responses")
            .then().statusCode(200).body("data.size()", is(2))
            .extract().path("data[0].id");

        given().when().delete(BASE + "/" + surveyId + "/responses/" + firstId)
            .then().statusCode(200);
        given().when().get(BASE + "/" + surveyId + "/responses")
            .then().statusCode(200).body("data.size()", is(1));

        given().when().delete(BASE + "/" + surveyId + "/responses")
            .then().statusCode(200);
        given().when().get(BASE + "/" + surveyId + "/responses")
            .then().statusCode(200).body("data.size()", is(0));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void submit_rejectedAfterResponseLimitReached() {
        String surveyId = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Limited\"}")
            .when().post(BASE)
            .then().statusCode(201)
            .extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Limited",
                  "status": "published",
                  "settings": { "responseLimit": 1 },
                  "questions": []
                }
                """)
            .when().put(BASE + "/" + surveyId)
            .then().statusCode(200);

        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(BASE + "/" + surveyId + "/responses").then().statusCode(201);
        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(BASE + "/" + surveyId + "/responses").then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void submit_rejectedAfterCloseTime() {
        String surveyId = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Temporary\"}")
            .when().post(BASE)
            .then().statusCode(201)
            .extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Temporary",
                  "status": "published",
                  "settings": { "closesAt": "2020-01-01T00:00:00Z" },
                  "questions": []
                }
                """)
            .when().put(BASE + "/" + surveyId)
            .then().statusCode(200);

        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(BASE + "/" + surveyId + "/responses")
            .then().statusCode(403).body("success", is(false));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void fullResultsFlow_aggregatesAnswers() {
        // create a survey
        String surveyId = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Feedback\"}")
            .when().post(BASE)
            .then().statusCode(201)
            .extract().path("data.id");

        // add a short-answer question
        String questionId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Feedback",
                  "status": "published",
                  "questions": [
                    {"type":"short-answer","title":"Your name?","required":false,"order":0}
                  ]
                }
                """)
            .when().put(BASE + "/" + surveyId)
            .then().statusCode(200)
            .extract().path("data.questions[0].id");

        // submit two responses
        for (String name : new String[] {"Ada", "Linus"}) {
            given()
                .contentType(ContentType.JSON)
                .body("{\"durationMs\":1200,\"answers\":[{\"questionId\":\"" + questionId
                    + "\",\"value\":\"" + name + "\"}]}")
                .when().post(BASE + "/" + surveyId + "/responses")
                .then().statusCode(201);
        }

        // aggregated results
        given()
            .when().get(BASE + "/" + surveyId + "/results")
            .then()
            .statusCode(200)
            .body("data.totalResponses", is(2))
            .body("data.questions[0].answered", is(2))
            .body("data.questions[0].textAnswers", hasItem("Ada"))
            .body("data.questions[0].textAnswers", hasItem("Linus"));

        // raw responses list
        given()
            .when().get(BASE + "/" + surveyId + "/responses")
            .then().statusCode(200).body("data.size()", is(2));
    }
}
