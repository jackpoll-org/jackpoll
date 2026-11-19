package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import java.util.List;
import org.acme.entity.Survey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class ColorPaletteTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String ERROR =
        "A color palette can have at most 10 colors, each written as #rgb or #rrggbb.";

    private String createSurvey() {
        return given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Palette\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
    }

    private io.restassured.response.ValidatableResponse save(String id, String surveyPalette, String questionPalette) {
        return given()
            .contentType(ContentType.JSON)
            .body("""
                {"title":"Palette","status":"draft",
                 "questions":[{"type":"wordcloud","title":"Words","required":false,"order":0,
                   "settings":{"maxWords":3,"colorPalette":%s}}],
                 "settings":{"colorPalette":%s}}
                """.formatted(questionPalette, surveyPalette))
            .when().put(SURVEYS + "/" + id)
            .then();
    }

    @Test
    @TestSecurity(user = "owner-palette")
    void storesSurveyAndQuestionPalettes() {
        String id = createSurvey();
        save(id, "[\"#112233\",\"#abc\"]", "[\"#FF0000\",\"#00ff00\"]")
            .statusCode(200)
            .body("data.settings.colorPalette[1]", is("#abc"))
            .body("data.questions[0].settings.colorPalette[0]", is("#FF0000"))
            .body("data.questions[0].settings.maxWords", is(3));
        save(id, "null", "null").statusCode(200);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "[\"red\"]",
        "[\"#12345\"]",
        "[\"#1122334\"]",
        "[\"url(x)\"]",
        "[3]",
        "\"#112233\"",
        "[\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\",\"#111\"]"
    })
    @TestSecurity(user = "owner-palette")
    void rejectsInvalidQuestionPalettes(String palette) {
        String id = createSurvey();
        save(id, "null", palette).statusCode(400).body("error", is(ERROR));
    }

    @Test
    @TestSecurity(user = "owner-palette")
    void rejectsInvalidSurveyPalettes() {
        String id = createSurvey();
        save(id, "[\"rgb(0,0,0)\"]", "null").statusCode(400).body("error", is(ERROR));
        save(id, "[" + String.join(",", java.util.Collections.nCopies(11, "\"#111\"")) + "]", "null")
            .statusCode(400);
    }

    @Test
    @TestSecurity(user = "owner-palette")
    void keepsAnUnchangedLegacyPalette() {
        String id = createSurvey();
        QuarkusTransaction.requiringNew().run(() -> {
            Survey survey = Survey.findById(id);
            survey.settings.colorPalette = List.of("rebeccapurple");
        });
        save(id, "[\"rebeccapurple\"]", "null").statusCode(200);
        save(id, "[\"tomato\"]", "null").statusCode(400);
    }
}
