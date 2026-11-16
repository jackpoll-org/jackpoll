package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayInputStream;
import java.util.List;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;

@QuarkusTest
class SurveyPageOrderTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    private static String choice(String id, String sectionId) {
        String section = sectionId == null ? "\"\"" : "\"" + sectionId + "\"";
        return """
            {"id":"%1$s","type":"multiple-choice","title":"%1$s","required":false,"sectionId":%2$s,
             "points":1,"correctAnswers":["ok-%1$s"],
             "options":[{"id":"ok-%1$s","label":"Right"},{"id":"no-%1$s","label":"Wrong"}]}
            """.formatted(id, section);
    }

    private static String[] createPagedQuiz() {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Paged\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        String late = "late-" + p;
        String blank = "blank-" + p;
        String early = "early-" + p;
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Paged", "status": "published",
                  "settings": {"isQuiz": true, "showLiveResults": true, "showCorrectAnswers": "with-answers",
                               "allowMultipleResponses": true},
                  "sections": [{"id":"p1-%1$s","title":"One","order":0},{"id":"p2-%1$s","title":"Two","order":1}],
                  "questions": [%2$s, %3$s, %4$s]
                }
                """.formatted(p, choice(late, "p2-" + p), choice(blank, null), choice(early, "p1-" + p)))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return new String[] {id, blank, early, late};
    }

    @Test
    @TestSecurity(user = "owner-page-order-dto")
    void theSurveyListsItsQuestionsInPageOrder() {
        var quiz = createPagedQuiz();
        given().when().get(SURVEYS + "/" + quiz[0])
            .then().statusCode(200)
            .body("data.questions.id", contains(quiz[1], quiz[2], quiz[3]))
            .body("data.questions.order", contains(0, 1, 2))
            .body("data.questions[0].sectionId", nullValue())
            .body("data.sections", hasSize(2));
        given().when().get(PUBLIC + "/" + quiz[0])
            .then().statusCode(200)
            .body("data.questions.id", contains(quiz[1], quiz[2], quiz[3]));
    }

    @Test
    @TestSecurity(user = "owner-page-order-results")
    void resultsAndCorrectionsFollowThePageOrder() {
        var quiz = createPagedQuiz();
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[" + answer(quiz[3]) + "," + answer(quiz[1]) + "," + answer(quiz[2]) + "]}")
            .when().post(SURVEYS + "/" + quiz[0] + "/responses")
            .then().statusCode(201)
            .body("data.corrections.questionId", contains(quiz[1], quiz[2], quiz[3]));
        given().when().get(SURVEYS + "/" + quiz[0] + "/results")
            .then().statusCode(200)
            .body("data.questions.questionId", contains(quiz[1], quiz[2], quiz[3]));
        given().when().get(PUBLIC + "/" + quiz[0] + "/live-results")
            .then().statusCode(200)
            .body("data.questions.questionId", contains(quiz[1], quiz[2], quiz[3]));
    }

    @Test
    @TestSecurity(user = "owner-page-order-xlsx")
    void theXlsxColumnsFollowThePageOrder() throws Exception {
        var quiz = createPagedQuiz();
        byte[] body = given().when().get(SURVEYS + "/" + quiz[0] + "/export/xlsx")
            .then().statusCode(200).extract().asByteArray();
        try (var wb = new XSSFWorkbook(new ByteArrayInputStream(body))) {
            var head = wb.getSheet("Responses").getRow(0);
            var titles = List.of(3, 4, 5).stream().map(i -> head.getCell(i).getStringCellValue()).toList();
            assertEquals(List.of(quiz[1], quiz[2], quiz[3]), titles);
        }
    }

    private static String answer(String questionId) {
        return "{\"questionId\":\"" + questionId + "\",\"value\":\"ok-" + questionId + "\"}";
    }
}
