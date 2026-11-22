package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

@QuarkusTest
class CombinedWordcloudBroadcastTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    @InjectMock
    ResultsRelay relay;

    private String publish(String settings) {
        return publish(settings, "{}");
    }

    private String publish(String settings, String choiceSettings) {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Broadcast\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Broadcast",
                  "status": "published",
                  "settings": %s,
                  "questions": [
                    {"type":"multiple-choice","title":"Pick","required":false,"order":0,
                     "settings":%s,"options":[{"label":"A"}]},
                    {"type":"wordcloud","title":"Hopes","required":false,"order":1}
                  ]
                }
                """.formatted(settings, choiceSettings))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
        return id;
    }

    private String submitAndCapture(String id) {
        var survey = given().when().get(PUBLIC + "/" + id).then().statusCode(200).extract();
        String mcId = survey.path("data.questions[0].id");
        String optA = survey.path("data.questions[0].options[0].id");
        String cloudId = survey.path("data.questions[1].id");
        given()
            .contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + mcId + "\",\"value\":\"" + optA + "\"},"
                + "{\"questionId\":\"" + cloudId + "\",\"value\":[\"Sun\"]}]}")
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201);
        var message = ArgumentCaptor.forClass(String.class);
        verify(relay, timeout(5000)).broadcast(eq(id), message.capture());
        assertThat(message.getValue(), not(containsString(mcId)));
        assertThat(message.getValue(), not(containsString(optA)));
        return message.getValue();
    }

    @Test
    @TestSecurity(user = "owner-1")
    void combinedWordcloudPushesOnlyWordDeltas() {
        String id = publish("{\"postSubmitCombinedWordcloud\": true}");
        String message = submitAndCapture(id);
        assertThat(message, containsString("\"sun\""));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void choiceShownAsWordcloudTriggersARefetchPing() {
        String id = publish("{\"postSubmitCombinedWordcloud\": true}", "{\"resultChart\": \"wordcloud\"}");
        assertThat(submitAndCapture(id), is(ResultsRelay.PING));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void regularLiveResultsWithAChoiceAnswerSendARefetchPing() {
        String id = publish("{\"showLiveResults\": true}");
        assertThat(submitAndCapture(id), is(ResultsRelay.PING));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void withoutAnyLiveSharingOnlyAPingIsSent() {
        String id = publish("{}");
        assertThat(submitAndCapture(id), is(ResultsRelay.PING));
    }

    @Test
    @TestSecurity(user = "owner-1")
    void ownerResultsAreUnaffectedByTheBroadcastFilter() {
        String id = publish("{\"postSubmitCombinedWordcloud\": true}");
        submitAndCapture(id);
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions.size()", is(2));
    }
}
