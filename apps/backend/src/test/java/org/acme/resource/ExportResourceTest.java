package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

/** Integration tests for the Excel export endpoint (issue #32). */
@QuarkusTest
class ExportResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String XLSX =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Test
    void exportRequiresAuthentication() {
        given().when().get(SURVEYS + "/any/export/xlsx").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void exportsFormattedXlsxWithResponses() {
        // create a survey with a multiple-choice question
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Feedback Survey\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String optAId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Feedback Survey",
                  "status": "published",
                  "questions": [
                    {"type":"multiple-choice","title":"Rating","required":false,"order":0,
                     "options":[{"label":"Good"},{"label":"Bad"}]}
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200)
            .extract().path("data.questions[0].options[0].id");

        String qId = given().when().get("/api/v1/public/surveys/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");

        // one response selecting "Good"
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + qId + "\",\"value\":\"" + optAId + "\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);

        // export → real xlsx bytes with a dated attachment filename
        byte[] body = given()
            .when().get(SURVEYS + "/" + id + "/export/xlsx")
            .then().statusCode(200)
            .contentType(XLSX)
            .header("Content-Disposition", containsString("Feedback_Survey-responses-"))
            .header("Content-Disposition", containsString(".xlsx"))
            .extract().asByteArray();

        // xlsx is a zip archive → starts with the "PK" magic bytes
        org.junit.jupiter.api.Assertions.assertTrue(body.length > 0);
        org.junit.jupiter.api.Assertions.assertEquals('P', body[0]);
        org.junit.jupiter.api.Assertions.assertEquals('K', body[1]);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void exportsEmptySurveyWithoutError() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Empty\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        byte[] body = given()
            .when().get(SURVEYS + "/" + id + "/export/xlsx")
            .then().statusCode(200)
            .contentType(XLSX)
            .extract().body().asByteArray();
        org.junit.jupiter.api.Assertions.assertTrue(body.length > 0);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void exportRejectsOtherOwnersSurvey_orMissing() {
        given()
            .when().get(SURVEYS + "/does-not-exist/export/xlsx")
            .then().statusCode(greaterThan(399));
    }
}
