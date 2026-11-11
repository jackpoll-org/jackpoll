package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class QuizPointsPerAnswerResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private static void save(String id, String p, int wrongPoints) {
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Points per answer", "status": "published",
                  "settings": {"isQuiz": true, "allowMultipleResponses": true},
                  "questions": [
                    {"id":"cb-%1$s","type":"checkboxes","title":"Pick","required":false,"order":0,
                     "correctAnswers":["a-%1$s","c-%1$s"],
                     "settings":{"optionPoints":{"a-%1$s":1,"b-%1$s":%2$d,"c-%1$s":1}},
                     "options":[{"id":"a-%1$s","label":"A"},{"id":"b-%1$s","label":"B"},{"id":"c-%1$s","label":"C"}]}
                  ]
                }
                """.formatted(p, wrongPoints))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-points")
    void scoresPerOptionHidesThePointsAndRescoresWhenTheyChange() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Points per answer\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        save(id, p, -1);

        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"cb-" + p + "\",\"value\":[\"a-" + p + "\",\"b-" + p + "\",\"c-" + p + "\"]}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201)
            .body("data.score", is(1))
            .body("data.maxScore", is(2));

        given().when().get("/api/v1/public/surveys/" + id)
            .then().statusCode(200)
            .body("data.questions[0].settings.optionPoints", nullValue())
            .body("data.questions[0].correctAnswers", nullValue());

        save(id, p, 0);

        given().when().get(SURVEYS + "/" + id + "/responses")
            .then().statusCode(200)
            .body("data[0].score", is(2));
    }

    @Test
    @TestSecurity(user = "owner-points")
    void liveResultsNeverListAScoredOrder() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Order\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Order", "status": "published",
                  "settings": {"isQuiz": true, "showLiveResults": true},
                  "questions": [
                    {"id":"rk-%1$s","type":"ranking","title":"Sort","required":false,"order":0,
                     "settings":{"scoreOrder":true},
                     "options":[{"id":"x-%1$s","label":"1"},{"id":"y-%1$s","label":"2"},{"id":"z-%1$s","label":"3"}]},
                    {"id":"mc-%1$s","type":"multiple-choice","title":"Pick","required":false,"order":1,
                     "correctAnswers":["x2-%1$s"],
                     "options":[{"id":"x2-%1$s","label":"A"},{"id":"y2-%1$s","label":"B"}]}
                  ]
                }
                """.formatted(p))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);

        given().when().get("/api/v1/public/surveys/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.questions.questionId", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("rk-" + p)))
            .body("data.questions.questionId", org.hamcrest.Matchers.hasItem("mc-" + p));
    }

    @Test
    @TestSecurity(user = "owner-points")
    void editingAResponseOverAndOverIsThrottled() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Edits\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Edits", "status": "published",
                  "settings": {"isQuiz": true, "allowEditResponses": true, "allowMultipleResponses": true},
                  "questions": [
                    {"id":"rk-%1$s","type":"ranking","title":"Sort","required":false,"order":0,
                     "settings":{"scoreOrder":true},
                     "options":[{"id":"x-%1$s","label":"1"},{"id":"y-%1$s","label":"2"}]}
                  ]
                }
                """.formatted(p))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        String answer = "{\"answers\":[{\"questionId\":\"rk-" + p + "\",\"value\":[\"y-" + p + "\",\"x-" + p + "\"]}]}";
        String token = given().contentType(ContentType.JSON).body(answer)
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).extract().path("data.editToken");

        for (int i = 0; i < PublicResponseResource.EDITS_PER_HOUR; i++) {
            given().contentType(ContentType.JSON).body(answer)
                .when().put("/api/v1/public/responses/" + token)
                .then().statusCode(200);
        }
        given().contentType(ContentType.JSON).body(answer)
            .when().put("/api/v1/public/responses/" + token)
            .then().statusCode(429);
        given().contentType(ContentType.JSON).body(answer)
            .when().put("/api/v1/public/responses/not-a-token")
            .then().statusCode(404);
    }
}
