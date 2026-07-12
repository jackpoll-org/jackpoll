package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.not;
import static org.hamcrest.Matchers.hasKey;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Wordcloud question type — word lists aggregate into a frequency map. */
@QuarkusTest
class WordcloudResultsTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-1")
    void wordcloudAnswersAggregateIntoAFrequencyMap() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Cloud\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Cloud", "status": "published",
                  "questions": [{
                    "type": "wordcloud", "title": "Describe today in a word",
                    "required": true, "order": 0,
                    "settings": { "maxWords": 3 }
                  }]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .body("data.questions[0].type", is("wordcloud"))
            .extract().path("data.questions[0].id");

        // Two respondents; "Sunny" is repeated and case/whitespace-normalized.
        // "shit" must be dropped by the default profanity filter.
        String[][] answers = {
            { "Sunny", "Warm", "shit" },
            { "  sunny ", "cold" },
        };
        for (String[] words : answers) {
            var json = new StringBuilder("[");
            for (int i = 0; i < words.length; i++) {
                if (i > 0) json.append(",");
                json.append("\"").append(words[i]).append("\"");
            }
            json.append("]");
            given()
                .contentType(ContentType.JSON)
                .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":" + json + "}]}")
                .when().post(SURVEYS + "/" + id + "/responses")
                .then().statusCode(201);
        }

        given()
            .when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.totalResponses", is(2))
            .body("data.questions[0].answered", is(2))
            .body("data.questions[0].optionCounts.sunny", is(2))
            .body("data.questions[0].optionCounts.warm", is(1))
            .body("data.questions[0].optionCounts.cold", is(1))
            // Profane word filtered out of the cloud (default on).
            .body("data.questions[0].optionCounts", not(hasKey("shit")));
    }
}
