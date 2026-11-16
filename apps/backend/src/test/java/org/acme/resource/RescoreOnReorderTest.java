package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;

@QuarkusTest
class RescoreOnReorderTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Inject
    EntityManager em;

    private static void save(String id, String p, boolean reversed, int points) {
        String first = """
            {"id":"a-%1$s","type":"multiple-choice","title":"A","required":false,"points":%2$d,
             "correctAnswers":["a1-%1$s"],"options":[{"id":"a1-%1$s","label":"1"},{"id":"a2-%1$s","label":"2"}]}
            """.formatted(p, points);
        String second = """
            {"id":"b-%1$s","type":"multiple-choice","title":"B","required":false,"points":1,
             "correctAnswers":["b1-%1$s"],"options":[{"id":"b1-%1$s","label":"1"},{"id":"b2-%1$s","label":"2"}]}
            """.formatted(p);
        given().contentType(ContentType.JSON)
            .body("""
                {"title":"Reorder","status":"published",
                 "settings":{"isQuiz":true,"allowMultipleResponses":true},
                 "questions":[%s,%s]}
                """.formatted(reversed ? second : first, reversed ? first : second))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-reorder")
    void reorderingQuestionsDoesNotRescoreButChangingPointsDoes() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Reorder\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        save(id, p, false, 1);
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"a-" + p + "\",\"value\":\"a1-" + p + "\"},"
                + "{\"questionId\":\"b-" + p + "\",\"value\":\"b1-" + p + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.score", is(2));
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                "update survey_responses set score = 99 where survey_id = ?1")
            .setParameter(1, id).executeUpdate());

        save(id, p, true, 1);
        given().when().get(SURVEYS + "/" + id + "/responses")
            .then().statusCode(200).body("data[0].score", is(99));

        save(id, p, true, 3);
        given().when().get(SURVEYS + "/" + id + "/responses")
            .then().statusCode(200).body("data[0].score", is(4));
    }
}
