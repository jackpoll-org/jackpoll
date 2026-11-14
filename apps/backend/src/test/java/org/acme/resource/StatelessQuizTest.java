package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.CoreMatchers.nullValue;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StatelessQuizTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    private record Quiz(String id, String p) {}

    private static String questions(String p, String extraQuestion) {
        return """
            [
              {"id":"mc-%1$s","type":"multiple-choice","title":"Capital of France?","required":false,
               "order":0,"points":2,"correctAnswers":["paris-%1$s"],
               "options":[{"id":"paris-%1$s","label":"Paris"},{"id":"rome-%1$s","label":"Rome"}]},
              {"id":"sa-%1$s","type":"short-answer","title":"2+2?","required":false,"order":1,
               "correctAnswers":["4","four"]},
              {"id":"rk-%1$s","type":"ranking","title":"Order","required":false,"order":2,
               "settings":{"scoreOrder":true},
               "options":[{"id":"one-%1$s","label":"One"},{"id":"two-%1$s","label":"Two"}]},
              {"id":"sl-%1$s","type":"slider","title":"Pick 7","required":false,"order":3,
               "correctAnswers":["7"],"settings":{"min":0,"max":10}},
              {"id":"txt-%1$s","type":"short-answer","title":"Your thoughts","required":false,"order":4}
              %2$s
            ]
            """.formatted(p, extraQuestion);
    }

    private static Quiz create() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Stateless\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        return new Quiz(id, id.substring(0, 8));
    }

    private static ValidatableResponse save(Quiz quiz, String settings, String extraQuestion) {
        return given().contentType(ContentType.JSON)
            .body("{\"title\":\"Stateless\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,"
                + "\"allowMultipleResponses\":true" + settings + "},\"questions\":"
                + questions(quiz.p(), extraQuestion) + "}")
            .when().put(SURVEYS + "/" + quiz.id())
            .then();
    }

    private static Quiz quiz(String settings) {
        var quiz = create();
        save(quiz, settings, "").statusCode(200);
        return quiz;
    }

    private static ValidatableResponse submit(Quiz quiz) {
        String p = quiz.p();
        return given().contentType(ContentType.JSON)
            .body("{\"answers\":["
                + "{\"questionId\":\"mc-" + p + "\",\"value\":\"rome-" + p + "\"},"
                + "{\"questionId\":\"sa-" + p + "\",\"value\":\" Four \"},"
                + "{\"questionId\":\"rk-" + p + "\",\"value\":[\"two-" + p + "\",\"one-" + p + "\"]},"
                + "{\"questionId\":\"sl-" + p + "\",\"value\":7}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201);
    }

    private static ValidatableResponse saveDraft(Quiz quiz) {
        return given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"sa-" + quiz.p() + "\",\"value\":\"4\"}],\"position\":0}")
            .when().post(PUBLIC + "/" + quiz.id() + "/drafts")
            .then();
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void draftsAreRejectedWhenSaveLaterIsOff() {
        saveDraft(quiz("")).statusCode(200);
        saveDraft(quiz(",\"disableSaveLater\":true")).statusCode(403);
        saveDraft(quiz(",\"doNotStoreResponses\":true")).statusCode(403);
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void statelessSubmitScoresButStoresNothing() {
        var quiz = quiz(",\"doNotStoreResponses\":true,\"passingScore\":2");

        submit(quiz)
            .body("data.score", is(2))
            .body("data.maxScore", is(5))
            .body("data.passed", is(true))
            .body("data.editToken", nullValue())
            .body("data.resultCode", nullValue());

        given().when().get(SURVEYS + "/" + quiz.id() + "/responses?preview=true")
            .then().statusCode(200).body("data", hasSize(0));
        given().when().get(SURVEYS + "/" + quiz.id() + "/results")
            .then().statusCode(200).body("data.totalResponses", is(0));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void doNotStoreResponsesIgnoredOutsideQuizzes() {
        var quiz = create();
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Survey\",\"status\":\"published\",\"settings\":{\"doNotStoreResponses\":true,"
                + "\"allowEditResponses\":true},\"questions\":" + questions(quiz.p(), "") + "}")
            .when().put(SURVEYS + "/" + quiz.id())
            .then().statusCode(200);
        submit(quiz);
        given().when().get(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(200).body("data", hasSize(1));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void rejectsSettingsThatNeedStoredResponses() {
        String[] settings = {
            "\"liveMode\":true", "\"studentResults\":true", "\"allowEditResponses\":true",
            "\"onePerBrowser\":true", "\"responseLimit\":10", "\"requireRespondentToken\":true",
            "\"ownerNotify\":\"each\"", "\"ownerNotify\":\"daily\"", "\"respondentReceipts\":true",
            "\"showLiveResults\":true",
        };
        for (var s : settings) {
            save(create(), ",\"doNotStoreResponses\":true," + s, "").statusCode(400)
                .body("error", is("Turn off \"Don't store responses\" to use live mode, live results,"
                    + " result lookup codes, response editing, one response per browser, a response limit,"
                    + " respondent tokens, email notifications or receipts."));
        }
        save(create(), ",\"doNotStoreResponses\":true,\"ownerNotify\":\"off\"", "").statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void rejectsQuestionsThatNeedStoredResponses() {
        String[] extra = {
            "{\"id\":\"la-%s\",\"type\":\"long-answer\",\"title\":\"Essay\",\"order\":5}",
            "{\"id\":\"mg-%s\",\"type\":\"short-answer\",\"title\":\"Graded\",\"order\":5,"
                + "\"settings\":{\"manualGrading\":true}}",
            "{\"id\":\"fu-%s\",\"type\":\"file-upload\",\"title\":\"File\",\"order\":5}",
            "{\"id\":\"sg-%s\",\"type\":\"signature\",\"title\":\"Sign\",\"order\":5}",
            "{\"id\":\"qt-%1$s\",\"type\":\"multiple-choice\",\"title\":\"Seat\",\"order\":5,"
                + "\"options\":[{\"id\":\"s1-%1$s\",\"label\":\"A\",\"capacity\":3}]}",
        };
        for (var q : extra) {
            var quiz = create();
            save(quiz, ",\"doNotStoreResponses\":true", "," + q.formatted(quiz.p())).statusCode(400)
                .body("error", is("Turn off \"Don't store responses\" to use paragraph, manually graded,"
                    + " file upload or signature questions, or answer limits."));
        }
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void submitShowsCorrectionsAfterSubmission() {
        for (var stateless : new boolean[] {false, true}) {
            var quiz = quiz(",\"showCorrectAnswers\":\"with-answers\",\"doNotStoreResponses\":" + stateless);
            String p = quiz.p();
            submit(quiz)
                .body("data.corrections", hasSize(4))
                .body("data.corrections[0].questionId", is("mc-" + p))
                .body("data.corrections[0].answer", is("rome-" + p))
                .body("data.corrections[0].correct", is(false))
                .body("data.corrections[0].points", is(0))
                .body("data.corrections[0].maxPoints", is(2))
                .body("data.corrections[0].correctAnswers", contains("paris-" + p))
                .body("data.corrections[1].correct", is(true))
                .body("data.corrections[1].points", is(1))
                .body("data.corrections[1].correctAnswers", contains("4", "four"))
                .body("data.corrections[2].correct", is(false))
                .body("data.corrections[2].correctAnswers", contains("one-" + p, "two-" + p))
                .body("data.corrections[3].correct", is(true))
                .body("data.corrections[3].correctAnswers", contains("7"));
        }
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void correctionsListPositiveOptionsWhenScoredPerOption() {
        var quiz = create();
        String p = quiz.p();
        given().contentType(ContentType.JSON)
            .body("""
                {"title":"Points","status":"published","settings":{"isQuiz":true,"showCorrectAnswers":"with-answers"},
                 "questions":[{"id":"cb-%1$s","type":"checkboxes","title":"Pick","required":false,"order":0,
                   "settings":{"optionPoints":{"a-%1$s":2,"b-%1$s":-1,"c-%1$s":1}},
                   "options":[{"id":"a-%1$s","label":"A"},{"id":"b-%1$s","label":"B"},{"id":"c-%1$s","label":"C"}]}]}
                """.formatted(p))
            .when().put(SURVEYS + "/" + quiz.id())
            .then().statusCode(200);
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[{\"questionId\":\"cb-" + p + "\",\"value\":[\"a-" + p + "\"]}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201)
            .body("data.corrections[0].points", is(2))
            .body("data.corrections[0].maxPoints", is(3))
            .body("data.corrections[0].correct", is(false))
            .body("data.corrections[0].correctAnswers", contains("a-" + p, "c-" + p));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void correctionsStayHiddenWhileAnswersCanStillChange() {
        String key = ",\"showCorrectAnswers\":\"with-answers\"";
        submit(quiz(key + ",\"allowEditResponses\":true")).body("data.corrections", nullValue());
        submit(quiz(key + ",\"studentResults\":true")).body("data.corrections", nullValue());
        submit(quiz(key + ",\"studentResults\":true,\"resultsReleased\":true")).body("data.corrections", hasSize(4));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void existingSettingsShowTheScoreButNoAnswerKey() {
        for (var setting : new String[] {"", ",\"showCorrectAnswers\":\"after-submission\"",
                ",\"showCorrectAnswers\":\"immediately\""}) {
            submit(quiz(setting))
                .body("data.score", is(2))
                .body("data.corrections", nullValue());
        }
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void correctionsCoverOnlyQuestionsTheParticipantSaw() {
        var quiz = quiz(",\"showCorrectAnswers\":\"with-answers\"");
        String p = quiz.p();
        String answer = "{\"questionId\":\"mc-" + p + "\",\"value\":\"rome-" + p + "\"}";
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[" + answer + "],\"shownQuestionIds\":[\"mc-" + p + "\",\"sa-" + p + "\"]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201)
            .body("data.corrections.questionId", contains("mc-" + p, "sa-" + p));
        given().contentType(ContentType.JSON)
            .body("{\"answers\":[" + answer + "]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201)
            .body("data.corrections.questionId", contains("mc-" + p));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void previewSubmissionsAreNotStoredEither() {
        var quiz = quiz(",\"doNotStoreResponses\":true");
        given().contentType(ContentType.JSON)
            .body("{\"preview\":true,\"answers\":[{\"questionId\":\"sa-" + quiz.p() + "\",\"value\":\"4\"}]}")
            .when().post(SURVEYS + "/" + quiz.id() + "/responses")
            .then().statusCode(201).body("data.score", is(1));
        given().when().get(SURVEYS + "/" + quiz.id() + "/responses?preview=true")
            .then().statusCode(200).body("data", hasSize(0));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void shareLinkResponseCapNeedsStoredResponses() {
        var quiz = quiz("");
        given().contentType(ContentType.JSON).body("{\"maxResponses\":5}")
            .when().put(SURVEYS + "/" + quiz.id() + "/share-link").then().statusCode(200);
        save(quiz, ",\"doNotStoreResponses\":true", "").statusCode(400);

        var stateless = quiz(",\"doNotStoreResponses\":true");
        given().contentType(ContentType.JSON).body("{\"maxResponses\":5}")
            .when().put(SURVEYS + "/" + stateless.id() + "/share-link").then().statusCode(400);
        given().contentType(ContentType.JSON).body("{\"expiresAt\":null}")
            .when().put(SURVEYS + "/" + stateless.id() + "/share-link").then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void onlyTheOwnerDecidesWhetherResponsesAreStored() {
        var quiz = quiz(",\"doNotStoreResponses\":true");
        String slug = given().when().post(SURVEYS + "/" + quiz.id() + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Stateless\",\"status\":\"published\",\"settings\":{\"isQuiz\":false},"
                + "\"questions\":" + questions(quiz.p(), "") + "}")
            .when().put("/api/v1/public/collab/" + slug)
            .then().statusCode(200);
        given().when().get(SURVEYS + "/" + quiz.id())
            .then().statusCode(200)
            .body("data.settings.isQuiz", is(true))
            .body("data.settings.doNotStoreResponses", is(true));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void onlyTheOwnerRevealsTheAnswerKey() {
        var quiz = quiz("");
        String slug = given().when().post(SURVEYS + "/" + quiz.id() + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Stateless\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,"
                + "\"showCorrectAnswers\":\"with-answers\"},\"questions\":" + questions(quiz.p(), "") + "}")
            .when().put("/api/v1/public/collab/" + slug)
            .then().statusCode(200);
        given().when().get(SURVEYS + "/" + quiz.id())
            .then().statusCode(200)
            .body("data.settings.showCorrectAnswers", nullValue());

        var revealing = quiz(",\"showCorrectAnswers\":\"with-answers\"");
        String revealingSlug = given().when().post(SURVEYS + "/" + revealing.id() + "/collab-link/rotate")
            .then().statusCode(200).extract().path("data.slug");
        for (var target : new String[] {"never", "after-submission"}) {
            given().contentType(ContentType.JSON)
                .body("{\"title\":\"Stateless\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,"
                    + "\"showCorrectAnswers\":\"" + target + "\"},\"questions\":" + questions(revealing.p(), "") + "}")
                .when().put("/api/v1/public/collab/" + revealingSlug)
                .then().statusCode(200);
        }
        given().when().get(SURVEYS + "/" + revealing.id())
            .then().statusCode(200)
            .body("data.settings.showCorrectAnswers", is("with-answers"));

        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Stateless\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,"
                + "\"showCorrectAnswers\":\"never\"},\"questions\":" + questions(quiz.p(), "") + "}")
            .when().put("/api/v1/public/collab/" + slug)
            .then().statusCode(200);
        given().when().get(SURVEYS + "/" + quiz.id())
            .then().statusCode(200)
            .body("data.settings.showCorrectAnswers", is("never"));
    }

    @Test
    @TestSecurity(user = "owner-stateless")
    void correctionsFollowTheSetting() {
        submit(quiz(",\"showCorrectAnswers\":\"with-answers\",\"doNotStoreResponses\":true"))
            .body("data.corrections", hasSize(4));
        submit(quiz(",\"showCorrectAnswers\":\"never\"")).body("data.corrections", nullValue());
        submit(quiz(",\"showCorrectAnswers\":\"never\",\"doNotStoreResponses\":true"))
            .body("data.corrections", nullValue());
    }
}
