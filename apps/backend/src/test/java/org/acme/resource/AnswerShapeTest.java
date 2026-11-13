package org.acme.resource;

import static io.restassured.RestAssured.given;

import java.util.List;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Answers must have the shape their question type submits, so owner pages can render them. */
@QuarkusTest
class AnswerShapeTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void rejectsAnswersOfTheWrongShape() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Shapes\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        List<String> q = given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Shapes", "status": "published", "settings": {"allowMultipleResponses": true},
                  "questions": [
                    {"type":"short-answer","title":"Name","required":false,"order":0},
                    {"type":"date","title":"When","required":false,"order":1},
                    {"type":"ranking","title":"Rank","required":false,"order":2,
                     "options":[{"label":"A"},{"label":"B"}]},
                    {"type":"wordcloud","title":"Words","required":false,"order":3},
                    {"type":"multiple-choice-grid","title":"MC grid","required":false,"order":4,
                     "rows":[{"label":"R"}],"columns":[{"label":"C"}]},
                    {"type":"checkbox-grid","title":"CB grid","required":false,"order":5,
                     "rows":[{"label":"R"}],"columns":[{"label":"C"}]},
                    {"type":"rating-grid","title":"Rating grid","required":false,"order":6,
                     "rows":[{"label":"R"}]}
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions.id");

        String[][] invalid = {
            {q.get(0), "{\"__proto__\":1}"},
            {q.get(1), "42"},
            {q.get(2), "\"a\""},
            {q.get(3), "[1]"},
            {q.get(4), "[\"c\"]"},
            {q.get(5), "{\"r\":\"c\"}"},
            {q.get(6), "{\"r\":\"5\"}"},
        };
        for (var answer : invalid) {
            submit(id, "{\"questionId\":\"" + answer[0] + "\",\"value\":" + answer[1] + "}").statusCode(400);
        }

        submit(id, String.join(",",
            "{\"questionId\":\"" + q.get(0) + "\",\"value\":\"Ada\"}",
            "{\"questionId\":\"" + q.get(1) + "\",\"value\":\"2026-11-12\"}",
            "{\"questionId\":\"" + q.get(2) + "\",\"value\":[\"a\",\"b\"]}",
            "{\"questionId\":\"" + q.get(3) + "\",\"value\":[\"hello\"]}",
            "{\"questionId\":\"" + q.get(4) + "\",\"value\":{\"r\":\"c\"}}",
            "{\"questionId\":\"" + q.get(5) + "\",\"value\":{\"r\":[\"c\"]}}",
            "{\"questionId\":\"" + q.get(6) + "\",\"value\":{\"r\":4}}"))
            .statusCode(201);
    }

    private static io.restassured.response.ValidatableResponse submit(String surveyId, String answers) {
        return given().contentType(ContentType.JSON)
            .body("{\"answers\":[" + answers + "]}")
            .when().post(SURVEYS + "/" + surveyId + "/responses")
            .then();
    }
}
