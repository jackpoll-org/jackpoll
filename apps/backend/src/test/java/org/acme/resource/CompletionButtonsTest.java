package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class CompletionButtonsTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Buttons\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
    }

    private io.restassured.response.ValidatableResponse save(String id, String status, String settings) {
        return given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Buttons","status":"%s",
                 "questions":[{"type":"short-answer","title":"Name","required":false,"order":0}],
                 "settings":%s}
                """.formatted(status, settings))
            .when().put(SURVEYS + "/" + id)
            .then();
    }

    private static String button(String label, String action, String url) {
        return """
            {"id":"b1","label":"%s","action":"%s","url":%s,"newTab":true,"enabled":true}
            """.formatted(label, action, url == null ? "null" : "\"" + url + "\"");
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void storesButtonsAndSubmitAnotherSettings() {
        String id = createSurvey();
        save(id, "draft", """
            {"completionButtons":[%s,{"id":"b2","label":"Close","action":"close","enabled":false}],
             "hideSubmitAnother":true,"submitAnotherLabel":"Again"}
            """.formatted(button("Directory", "url", "https://example.com/quizzes")))
            .statusCode(200)
            .body("data.settings.completionButtons[0].label", is("Directory"))
            .body("data.settings.completionButtons[0].url", is("https://example.com/quizzes"))
            .body("data.settings.completionButtons[0].newTab", is(true))
            .body("data.settings.completionButtons[1].action", is("close"))
            .body("data.settings.completionButtons[1].enabled", is(false))
            .body("data.settings.hideSubmitAnother", is(true))
            .body("data.settings.submitAnotherLabel", is("Again"));
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void defaultsLeaveTheCompletionScreenUnchanged() {
        String id = createSurvey();
        save(id, "draft", "{}")
            .statusCode(200)
            .body("data.settings.completionButtons", nullValue())
            .body("data.settings.hideSubmitAnother", is(false))
            .body("data.settings.submitAnotherLabel", nullValue());
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "javascript:alert(1)",
        "data:text/html,hi",
        "vbscript:msgbox",
        "//evil.example",
        "/relative/path",
        "mailto:a@b.c",
        "javascript://%0aalert(1)",
        "https://user@evil.example",
        "https://:80",
        "https://a%zz",
        "example.com:\u0661\u0662",
        "http\u017f://example.com",
        "https://",
        "https://exa mple.com",
        "ftp://example.com"
    })
    @TestSecurity(user = "owner-buttons")
    void rejectsUnsafeLinks(String url) {
        String id = createSurvey();
        save(id, "draft", "{\"completionButtons\":[" + button("Go", "url", url) + "]}")
            .statusCode(400)
            .body("error", is("Link must start with http:// or https://"));
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void rejectsUnknownActionAndOverlongValues() {
        String id = createSurvey();
        save(id, "draft", "{\"completionButtons\":[" + button("Go", "download", null) + "]}")
            .statusCode(422);
        save(id, "draft", "{\"completionButtons\":[" + button("x".repeat(81), "close", null) + "]}")
            .statusCode(422);
        save(id, "draft", "{\"completionButtons\":[" + button("Go", "url", "https://e.com/" + "a".repeat(2040)) + "]}")
            .statusCode(422);
        save(id, "draft", "{\"submitAnotherLabel\":\"" + "x".repeat(81) + "\"}")
            .statusCode(422);
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void rejectsMoreThanTenButtons() {
        String id = createSurvey();
        String eleven = String.join(",", java.util.Collections.nCopies(11, button("Close", "close", null)));
        save(id, "draft", "{\"completionButtons\":[" + eleven + "]}").statusCode(422);
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void acceptsBareHostsAndIncompleteButtonsOnPublish() {
        String id = createSurvey();
        save(id, "published", "{\"completionButtons\":[" + button("", "url", "example.com/quizzes") + "]}")
            .statusCode(200)
            .body("data.settings.completionButtons[0].url", is("example.com/quizzes"));
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void dropsTheLinkOfNonLinkButtons() {
        String id = createSurvey();
        save(id, "draft", "{\"completionButtons\":[" + button("Close", "close", "htp://x") + "]}")
            .statusCode(200)
            .body("data.settings.completionButtons[0].url", nullValue());
    }

    @Test
    @TestSecurity(user = "owner-buttons")
    void rejectsNullButtonsAndMissingIds() {
        String id = createSurvey();
        save(id, "draft", "{\"completionButtons\":[null]}").statusCode(422);
        save(id, "draft", "{\"completionButtons\":[{\"label\":\"Go\",\"action\":\"close\",\"enabled\":true}]}")
            .statusCode(422);
    }
}
