package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import org.acme.entity.CollaboratorRole;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.Survey;
import org.acme.entity.SurveyCollaborator;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.SurveyRepository;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;

@QuarkusTest
class RespondentTokenResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";

    @Inject
    SurveyRepository surveys;

    @Inject
    CollaboratorRepository collaborators;

    private String[] createSurvey(String settings) {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Vote\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        String qId = given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Vote", "status": "published",
                  "settings": %s,
                  "questions": [
                    {"type":"short-answer","title":"Q1","required":false,"order":0},
                    {"type":"short-answer","title":"Q2","required":false,"order":1}
                  ]
                }
                """.formatted(settings))
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions[0].id");
        return new String[] {id, qId};
    }

    private String addTokens(String surveyId, String... tokens) {
        var body = new StringBuilder("{\"tokens\":[");
        for (int i = 0; i < tokens.length; i++) {
            body.append(i > 0 ? "," : "").append('"').append(tokens[i]).append('"');
        }
        return given().contentType(ContentType.JSON).body(body.append("]}").toString())
            .when().post(SURVEYS + "/" + surveyId + "/respondent-tokens")
            .then().statusCode(200).extract().asString();
    }

    private int submit(String surveyId, String questionId, String token) {
        var tokenField = token == null ? "" : "\"respondentToken\":\"" + token + "\",";
        return given().contentType(ContentType.JSON)
            .body("{" + tokenField + "\"answers\":[{\"questionId\":\"" + questionId + "\",\"value\":\"x\"}]}")
            .when().post(SURVEYS + "/" + surveyId + "/responses")
            .then().extract().statusCode();
    }

    @Test
    void tokenEndpointsRequireSignIn() {
        given().when().get(SURVEYS + "/x/respondent-tokens").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "token-owner-crud")
    void ownerGeneratesAddsListsAndRemovesTokens() {
        var survey = createSurvey("{\"requireRespondentToken\":true}");
        String base = SURVEYS + "/" + survey[0] + "/respondent-tokens";

        given().contentType(ContentType.JSON).body("{\"count\":3}")
            .when().post(base + "/generate")
            .then().statusCode(200).body("data", hasSize(3)).body("data[0].token.length()", is(12));

        given().contentType(ContentType.JSON).body("{\"tokens\":[\" alice \",\"bob\",\"alice\"]}")
            .when().post(base)
            .then().statusCode(200).body("data", hasSize(5)).body("data.token", hasItems("alice", "bob"));

        given().contentType(ContentType.JSON).body("{\"tokens\":[\"bob\"]}")
            .when().post(base)
            .then().statusCode(200).body("data", hasSize(5));

        String bobId = given().when().get(base)
            .then().statusCode(200).body("data[0].usedAt", nullValue())
            .extract().path("data.find { it.token == 'bob' }.id");
        given().when().delete(base + "/" + bobId).then().statusCode(200);
        given().when().delete(base + "/" + bobId).then().statusCode(404);
        given().when().get(base).then().body("data", hasSize(4));

        given().when().delete(base).then().statusCode(200);
        given().when().get(base).then().body("data", hasSize(0));

        given().contentType(ContentType.JSON).body("{\"count\":0}")
            .when().post(base + "/generate").then().statusCode(422);
    }

    @Test
    @TestSecurity(user = "token-owner-public")
    void publicSurveyNeverExposesTheTokenList() {
        var survey = createSurvey("{\"requireRespondentToken\":true}");
        addTokens(survey[0], "secret-token-1");

        var body = given().when().get("/api/v1/public/surveys/" + survey[0])
            .then().statusCode(200).body("data.settings.requireRespondentToken", is(true))
            .extract().asString();
        Assertions.assertFalse(body.contains("secret-token-1"));
    }

    @Test
    @TestSecurity(user = "token-owner-submit")
    void eachTokenAllowsExactlyOneSubmission() {
        var survey = createSurvey("{\"requireRespondentToken\":true,\"allowMultipleResponses\":true}");
        addTokens(survey[0], "alice", "bob");

        Assertions.assertEquals(422, submit(survey[0], survey[1], null));
        Assertions.assertEquals(403, submit(survey[0], survey[1], "mallory"));
        Assertions.assertEquals(201, submit(survey[0], survey[1], " alice "));
        given().contentType(ContentType.JSON)
            .body("{\"respondentToken\":\"alice\",\"answers\":[]}")
            .when().post(SURVEYS + "/" + survey[0] + "/responses")
            .then().statusCode(403).body("error", is("This token has already been used."));

        given().contentType(ContentType.JSON)
            .body("{\"preview\":true,\"answers\":[]}")
            .when().post(SURVEYS + "/" + survey[0] + "/responses")
            .then().statusCode(201);

        given().when().get(SURVEYS + "/" + survey[0] + "/responses")
            .then().statusCode(200)
            .body("data", hasSize(1))
            .body("data[0].respondentToken", is("alice"));

        given().when().get(SURVEYS + "/" + survey[0] + "/respondent-tokens")
            .then().body("data.find { it.token == 'alice' }.usedAt", notNullValue())
            .body("data.find { it.token == 'bob' }.usedAt", nullValue());

        byte[] xlsx = given().when().get(SURVEYS + "/" + survey[0] + "/export/xlsx")
            .then().statusCode(200).extract().asByteArray();
        try (var wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(xlsx))) {
            var sheet = wb.getSheet("Responses");
            Assertions.assertEquals("Token", sheet.getRow(0).getCell(3).getStringCellValue());
            Assertions.assertEquals("alice", sheet.getRow(1).getCell(3).getStringCellValue());
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    @TestSecurity(user = "token-owner-race")
    void concurrentSubmissionsWithOneTokenRecordOnlyOne() throws Exception {
        var survey = createSurvey("{\"requireRespondentToken\":true,\"allowMultipleResponses\":true}");
        addTokens(survey[0], "once");

        var pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Integer>> calls = java.util.Collections.nCopies(
                8, () -> submit(survey[0], survey[1], "once"));
            long created = pool.invokeAll(calls).stream()
                .filter(f -> {
                    try {
                        return f.get() == 201;
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                })
                .count();
            Assertions.assertEquals(1, created);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @TestSecurity(user = "token-owner-edit")
    void editingAResponseNeedsNoNewToken() {
        var survey = createSurvey(
            "{\"requireRespondentToken\":true,\"allowEditResponses\":true}");
        addTokens(survey[0], "editor-token");

        String editToken = given().contentType(ContentType.JSON)
            .body("{\"respondentToken\":\"editor-token\",\"answers\":[{\"questionId\":\""
                + survey[1] + "\",\"value\":\"x\"}]}")
            .when().post(SURVEYS + "/" + survey[0] + "/responses")
            .then().statusCode(201).extract().path("data.editToken");

        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"" + survey[1] + "\",\"value\":\"y\"}]}")
            .when().put("/api/v1/public/responses/" + editToken)
            .then().statusCode(200).body("data.respondentToken", is("editor-token"));
    }

    @Test
    @TestSecurity(user = "token-owner-live")
    void liveTokenAnswersEachQuestionOnceWithinItsSession() {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Live\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");
        List<String> questionIds = given().contentType(ContentType.JSON)
            .body("""
                {
                  "title": "Live", "status": "published",
                  "settings": {"liveMode": true, "requireRespondentToken": true},
                  "questions": [
                    {"type":"short-answer","title":"Q1","required":false,"order":0},
                    {"type":"short-answer","title":"Q2","required":false,"order":1}
                  ]
                }
                """)
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200).extract().path("data.questions.id");
        addTokens(id, "player");
        given().when().post(SURVEYS + "/" + id + "/live/sessions").then().statusCode(200);

        Assertions.assertEquals(201, submit(id, questionIds.get(0), "player"));
        Assertions.assertEquals(201, submit(id, questionIds.get(1), "player"));
        Assertions.assertEquals(403, submit(id, questionIds.get(0), "player"));

        given().when().post(SURVEYS + "/" + id + "/live/sessions").then().statusCode(200);
        Assertions.assertEquals(403, submit(id, questionIds.get(0), "player"));
    }

    @Test
    @TestSecurity(user = "token-viewer")
    void viewerCannotManageTokensButEditorCan() {
        String viewerSurvey = foreignSurvey(CollaboratorRole.VIEWER);
        given().when().get(SURVEYS + "/" + viewerSurvey + "/respondent-tokens").then().statusCode(403);
        given().contentType(ContentType.JSON).body("{\"count\":1}")
            .when().post(SURVEYS + "/" + viewerSurvey + "/respondent-tokens/generate")
            .then().statusCode(403);

        String editorSurvey = foreignSurvey(CollaboratorRole.EDITOR);
        given().contentType(ContentType.JSON).body("{\"count\":2}")
            .when().post(SURVEYS + "/" + editorSurvey + "/respondent-tokens/generate")
            .then().statusCode(200).body("data", hasSize(2));

        given().when().get(SURVEYS + "/" + UUID.randomUUID() + "/respondent-tokens").then().statusCode(404);
    }

    private String foreignSurvey(CollaboratorRole role) {
        String id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = id;
            survey.ownerId = "someone-else";
            survey.title = "Shared";
            survey.status = SurveyStatus.PUBLISHED;
            survey.settings = SurveySettings.defaults();
            surveys.persist(survey);
            var collaborator = new SurveyCollaborator();
            collaborator.id = UUID.randomUUID().toString();
            collaborator.surveyId = id;
            collaborator.userId = "token-viewer";
            collaborator.role = role;
            collaborator.status = CollaboratorStatus.ACCEPTED;
            collaborator.createdAt = Instant.now();
            collaborators.persist(collaborator);
        });
        return id;
    }
}
