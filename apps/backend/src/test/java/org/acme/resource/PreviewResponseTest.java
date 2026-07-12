package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Preview/test submissions are excluded from results unless explicitly asked (#). */
@QuarkusTest
class PreviewResponseTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    @TestSecurity(user = "owner-preview")
    void previewSubmissionsAreExcludedFromResultsAndDeletable() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"P\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "P", "status": "published",
                  "questions": [{"type":"short-answer","title":"Name","required":false,"order":0}],
                  "settings": {}
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");

        // One real submission.
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"Real\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);

        // One preview submission.
        given().contentType(ContentType.JSON)
            .body("{\"preview\":true,\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"Test\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);

        // Default results exclude the preview row.
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200).body("data.totalResponses", is(1));

        // ?preview=true includes it.
        given().when().get(SURVEYS + "/" + id + "/results?preview=true")
            .then().statusCode(200).body("data.totalResponses", is(2));

        // Delete preview data → only the real one remains.
        given().when().delete(SURVEYS + "/" + id + "/responses/preview")
            .then().statusCode(200);
        given().when().get(SURVEYS + "/" + id + "/results?preview=true")
            .then().statusCode(200).body("data.totalResponses", is(1));
    }
}
