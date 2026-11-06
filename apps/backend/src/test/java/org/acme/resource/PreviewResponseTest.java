package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import java.util.UUID;

import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.acme.repository.SurveyRepository;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

/** Preview/test submissions are excluded from results unless explicitly asked (#). */
@QuarkusTest
class PreviewResponseTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Inject
    SurveyRepository surveys;

    private String foreignSurvey(SurveyStatus status) {
        String id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = id;
            survey.ownerId = "someone-else";
            survey.title = "Foreign";
            survey.status = status;
            survey.settings = SurveySettings.defaults();
            surveys.persist(survey);
        });
        return id;
    }

    @Test
    void anonymousPreviewIsRejected() {
        String id = foreignSurvey(SurveyStatus.PUBLISHED);
        given().contentType(ContentType.JSON)
            .body("{\"preview\":true,\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);
    }

    @Test
    @TestSecurity(user = "stranger")
    void previewNeedsAccessToTheSurvey() {
        String id = foreignSurvey(SurveyStatus.PUBLISHED);
        given().contentType(ContentType.JSON)
            .body("{\"preview\":true,\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(404);
    }

    @Test
    void draftsAcceptNoResponses() {
        String id = foreignSurvey(SurveyStatus.DRAFT);
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[]}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);
    }

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
