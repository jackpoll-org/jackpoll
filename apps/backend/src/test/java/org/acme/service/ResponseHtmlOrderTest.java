package org.acme.service;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;

@QuarkusTest
class ResponseHtmlOrderTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Inject
    ResponseService responseService;

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseRepository responses;

    @Test
    @TestSecurity(user = "owner-pdf-order")
    void responseHtmlFollowsThePageOrder() {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Paged\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Paged", "status": "published",
                  "sections": [{"id":"p1-%1$s","title":"Page <one>","order":0},
                               {"id":"p2-%1$s","title":"Page two","order":1}],
                  "questions": [
                    {"id":"late-%1$s","type":"short-answer","title":"Created first","required":false,
                     "order":0,"sectionId":"p2-%1$s"},
                    {"id":"info-%1$s","type":"content","title":"Read <this>","description":"Some & info",
                     "required":false,"order":1,"sectionId":"p1-%1$s"},
                    {"id":"early-%1$s","type":"short-answer","title":"Created second","required":false,
                     "order":2,"sectionId":"p1-%1$s"}
                  ]
                }
                """.formatted(p))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        String responseId = given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"late-" + p + "\",\"value\":\"A\"},"
                + "{\"questionId\":\"early-" + p + "\",\"value\":\"<b>B</b>\"}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).extract().path("data.id");

        var html = render(id, responseId);

        int pageOne = html.indexOf("Page &lt;one&gt;");
        int info = html.indexOf("Read &lt;this&gt;");
        int early = html.indexOf("Created second");
        int pageTwo = html.indexOf("Page two");
        int late = html.indexOf("Created first");
        assertTrue(pageOne >= 0 && pageOne < info && info < early && early < pageTwo && pageTwo < late, html);
        assertTrue(html.contains("Some &amp; info"), html);
        assertTrue(html.contains("&lt;b&gt;B&lt;/b&gt;"), html);
        assertTrue(!html.contains("<b>B</b>") && !html.contains("Read <this>"), html);
    }

    private String render(String surveyId, String responseId) {
        return QuarkusTransaction.requiringNew().call(() ->
            responseService.buildResponseHtml(surveys.findById(surveyId), responses.findById(responseId)));
    }
}
