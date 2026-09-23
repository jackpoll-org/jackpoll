package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.acme.repository.NotificationRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;

/**
 * A live quiz submits one response per player per question, so a per-answer
 * "new response" notification would bury the owner (200 players x 10
 * questions = 2000 notifications per game). Live surveys skip it; regular
 * surveys keep it.
 */
@QuarkusTest
class LiveResponseNotificationTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Inject
    NotificationRepository notifications;

    @Test
    @TestSecurity(user = "owner-live-notif")
    void liveSurveySubmissionsCreateNoNewResponseNotification() {
        submitTwice(createSurvey("{\"liveMode\":true,\"isQuiz\":true}"));

        assertEquals(0, newResponseNotifications("owner-live-notif"));
    }

    @Test
    @TestSecurity(user = "owner-regular-notif")
    void regularSurveySubmissionsStillNotifyTheOwner() {
        submitTwice(createSurvey("{}"));

        assertEquals(2, newResponseNotifications("owner-regular-notif"));
    }

    private String[] createSurvey(String settings) {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"N\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        String qId = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "N", "status": "published",
                  "questions": [{"type":"short-answer","title":"Q","required":false,"order":0}],
                  "settings": %s
                }
                """.formatted(settings))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");
        return new String[] {id, qId};
    }

    private void submitTwice(String[] survey) {
        for (int i = 0; i < 2; i++) {
            given().contentType(ContentType.JSON)
                .body("{\"answers\":[{\"questionId\":\"" + survey[1] + "\",\"value\":\"A\"}]}")
                .when().post(SURVEYS + "/" + survey[0] + "/responses").then().statusCode(201);
        }
    }

    private long newResponseNotifications(String owner) {
        return notifications.count("userId = ?1 and eventType = ?2", owner, "new_response");
    }
}
