package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.UUID;

import org.acme.entity.CollaboratorRole;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.Survey;
import org.acme.entity.SurveyCollaborator;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.acme.entity.LiveSession;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.LiveSessionRepository;
import org.acme.repository.SurveyRepository;
import org.acme.service.StorageService;
import org.acme.service.UploadCleanupService;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

@QuarkusTest
class ScheduledRunsTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";
    private static final String OWNER = "runs-owner";
    private static final String MEMBER = "runs-member";

    @Inject
    SurveyRepository surveys;

    @Inject
    CollaboratorRepository collaborators;

    @Inject
    EntityManager em;

    @Inject
    LiveSessionRepository runRepository;

    @Inject
    UploadCleanupService cleanup;

    @Inject
    StorageService storage;

    private static Instant hoursFromNow(long hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS);
    }

    private static String runBody(String label, Instant opensAt, Instant closesAt) {
        return "{\"label\":\"" + label + "\",\"opensAt\":\"" + opensAt + "\",\"closesAt\":\"" + closesAt + "\"}";
    }

    private static String question(String p, String title, String... options) {
        var opts = new ArrayList<String>();
        for (var o : options) opts.add("{\"id\":\"" + o + "-" + p + "\",\"label\":\"" + o + "\"}");
        return """
            {"id":"q-%1$s","type":"multiple-choice","title":"%2$s","required":false,"points":1,
             "correctAnswers":["a-%1$s"],"options":[%3$s]}
            """.formatted(p, title, String.join(",", opts));
    }

    private static void save(String id, String settings, String questions) {
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"published\",\"settings\":" + settings
                + ",\"questions\":[" + questions + "]}")
            .when().put(SURVEYS + "/" + id)
            .then().statusCode(200);
    }

    private static String survey(String settings, String questionsTemplate) {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Runs\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        save(id, settings, questionsTemplate.replace("%p", id.substring(0, 8)));
        return id;
    }

    private static String run(String surveyId, String label, Instant opensAt, Instant closesAt) {
        return given().contentType(ContentType.JSON).body(runBody(label, opensAt, closesAt))
            .when().post(SURVEYS + "/" + surveyId + "/runs")
            .then().statusCode(201)
            .body("data.label", is(label))
            .extract().path("data.id");
    }

    private static String answer(String p, String option, String extra) {
        return "{\"answers\":[{\"questionId\":\"q-" + p + "\",\"value\":\"" + option + "-" + p + "\"}]" + extra + "}";
    }

    private String foreignSurvey(CollaboratorRole role) {
        String id = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var survey = new Survey();
            survey.id = id;
            survey.ownerId = "runs-someone-else";
            survey.title = "Shared";
            survey.status = SurveyStatus.PUBLISHED;
            survey.settings = SurveySettings.defaults();
            surveys.persist(survey);
            var collaborator = new SurveyCollaborator();
            collaborator.id = UUID.randomUUID().toString();
            collaborator.surveyId = id;
            collaborator.userId = MEMBER;
            collaborator.role = role;
            collaborator.status = CollaboratorStatus.ACCEPTED;
            collaborator.createdAt = Instant.now();
            collaborators.persist(collaborator);
        });
        return id;
    }

    @Test
    @TestSecurity(user = OWNER)
    void ownerManagesRunsAndCannotDeleteOneWithResponses() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        String runId = run(id, "Semester 1", hoursFromNow(-1), hoursFromNow(1));
        String later = run(id, "Semester 2", hoursFromNow(24), hoursFromNow(25));

        given().when().get(SURVEYS + "/" + id + "/runs")
            .then().statusCode(200)
            .body("data", hasSize(2))
            .body("data[0].id", is(later))
            .body("data[0].status", is("scheduled"))
            .body("data[1].status", is("open"))
            .body("data[1].responseCount", is(0));

        given().contentType(ContentType.JSON).body(runBody("  Semester 2b  ", hoursFromNow(48), hoursFromNow(49)))
            .when().put(SURVEYS + "/" + id + "/runs/" + later)
            .then().statusCode(200).body("data.label", is("Semester 2b"));

        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.sessionId", is(runId));

        given().when().delete(SURVEYS + "/" + id + "/runs/" + runId)
            .then().statusCode(409).body("code", is("RUN_HAS_RESPONSES")).body("success", is(false));
        given().contentType(ContentType.JSON).body(runBody("Semester 1", hoursFromNow(-2), hoursFromNow(1)))
            .when().put(SURVEYS + "/" + id + "/runs/" + runId)
            .then().statusCode(409).body("code", is("RUN_STARTED"));

        given().when().post(SURVEYS + "/" + id + "/runs/" + runId + "/close")
            .then().statusCode(200).body("data.status", is("closed")).body("data.closedAt", notNullValue())
            .body("data.responseCount", is(1));

        given().contentType(ContentType.JSON).body(runBody("Next year", hoursFromNow(8760), hoursFromNow(8761)))
            .when().post(SURVEYS + "/" + id + "/runs/" + runId + "/duplicate")
            .then().statusCode(201).body("data.label", is("Next year")).body("data.status", is("scheduled"));

        given().when().delete(SURVEYS + "/" + id + "/runs/" + later).then().statusCode(204);
        given().when().get(SURVEYS + "/" + id + "/runs").then().statusCode(200).body("data", hasSize(2));

        given().when().get(SURVEYS + "/" + id + "/live/sessions")
            .then().statusCode(200)
            .body("data.kind", hasItem("scheduled"))
            .body("data.label", hasItem("Semester 1"));
    }

    @Test
    @TestSecurity(user = OWNER)
    void rejectsInvalidRunsAndLiveSurveys() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String runs = SURVEYS + "/" + id + "/runs";
        given().contentType(ContentType.JSON).body(runBody("   ", hoursFromNow(1), hoursFromNow(2)))
            .when().post(runs).then().statusCode(400);
        given().contentType(ContentType.JSON).body(runBody("x".repeat(121), hoursFromNow(1), hoursFromNow(2)))
            .when().post(runs).then().statusCode(400);
        given().contentType(ContentType.JSON).body(runBody("Backwards", hoursFromNow(2), hoursFromNow(1)))
            .when().post(runs).then().statusCode(400);
        given().contentType(ContentType.JSON).body("{\"label\":\"No times\"}")
            .when().post(runs).then().statusCode(400);

        String live = survey("{\"liveMode\":true}", question("%p", "Q", "a", "b"));
        given().contentType(ContentType.JSON).body(runBody("Live", hoursFromNow(1), hoursFromNow(2)))
            .when().post(SURVEYS + "/" + live + "/runs").then().statusCode(400);
    }

    @Test
    @TestSecurity(user = MEMBER)
    void viewerIsForbiddenAndEditorCannotDelete() {
        String viewed = foreignSurvey(CollaboratorRole.VIEWER);
        given().when().get(SURVEYS + "/" + viewed + "/runs").then().statusCode(403);
        given().contentType(ContentType.JSON).body(runBody("No", hoursFromNow(1), hoursFromNow(2)))
            .when().post(SURVEYS + "/" + viewed + "/runs").then().statusCode(403);

        String edited = foreignSurvey(CollaboratorRole.EDITOR);
        String runId = given().contentType(ContentType.JSON).body(runBody("Yes", hoursFromNow(1), hoursFromNow(2)))
            .when().post(SURVEYS + "/" + edited + "/runs").then().statusCode(201).extract().path("data.id");
        given().when().get(SURVEYS + "/" + edited + "/runs").then().statusCode(200).body("data", hasSize(1));
        given().when().post(SURVEYS + "/" + edited + "/runs/" + runId + "/close").then().statusCode(200);
        given().when().delete(SURVEYS + "/" + edited + "/runs/" + runId).then().statusCode(403);

        given().when().get(SURVEYS + "/" + UUID.randomUUID() + "/runs").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = OWNER)
    void routesSubmissionsToTheOpenRun() {
        String id = survey("{\"allowMultipleResponses\":true}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        String submit = SURVEYS + "/" + id + "/responses";
        var nextOpen = hoursFromNow(5);
        String future = run(id, "Future", nextOpen, hoursFromNow(6));

        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(submit)
            .then().statusCode(403)
            .body("code", is("NO_OPEN_RUN"))
            .body("nextOpensAt", is(nextOpen.truncatedTo(ChronoUnit.MICROS).toString()));
        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.questions", hasSize(0))
            .body("data.runs", hasSize(1))
            .body("data.runs[0].status", is("scheduled"));

        String first = run(id, "Class A", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(submit)
            .then().statusCode(201).body("data.sessionId", is(first));
        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.questions", hasSize(1))
            .body("data.run.id", is(first))
            .body("data.runs.id", containsInAnyOrder(first, future));

        String second = run(id, "Class B", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(submit)
            .then().statusCode(409)
            .body("success", is(false))
            .body("code", is("RUN_REQUIRED"))
            .body("reason", is("RUN_REQUIRED"))
            .body("runs.id", containsInAnyOrder(first, second));
        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200).body("data.questions", hasSize(0)).body("data.run", nullValue());
        given().contentType(ContentType.JSON).body(answer(p, "b", ",\"runId\":\"" + second + "\""))
            .when().post(submit)
            .then().statusCode(201).body("data.sessionId", is(second));
        given().contentType(ContentType.JSON).body(answer(p, "b", ",\"runId\":\"" + future + "\""))
            .when().post(submit)
            .then().statusCode(409).body("code", is("RUN_NOT_OPEN"));
        given().when().get(PUBLIC + "/" + id + "?run=" + future)
            .then().statusCode(200).body("data.questions", hasSize(0)).body("data.run.status", is("scheduled"));

        given().when().get(SURVEYS + "/" + id + "/results?session=" + second)
            .then().statusCode(200).body("data.totalResponses", is(1));
        given().when().get(SURVEYS + "/" + id + "/responses?session=" + first)
            .then().statusCode(200).body("data", hasSize(1)).body("data[0].sessionId", is(first));

        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"closed\",\"questions\":[" + question(p, "Q", "a", "b") + "]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + first + "\""))
            .when().post(submit).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = OWNER)
    void draftSurveyWithOpenRunAcceptsNothing() {
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Draft\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        String runId = run(id, "Open", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body("{\"answers\":[],\"runId\":\"" + runId + "\"}")
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);
        given().when().get(PUBLIC + "/" + id).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = OWNER)
    void limitsOneResponsePerBrowserAndDraftsPerRun() {
        String id = survey("{\"onePerBrowser\":true,\"responseLimit\":2}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        String submit = SURVEYS + "/" + id + "/responses";
        String a = run(id, "A", hoursFromNow(-1), hoursFromNow(1));
        String b = run(id, "B", hoursFromNow(-1), hoursFromNow(1));

        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-1\",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(201);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-1\",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(400);
        given().contentType(ContentType.JSON).body("{\"clientId\":\"browser-1\",\"runId\":\"" + a + "\"}")
            .when().post(PUBLIC + "/" + id + "/responded").then().statusCode(200).body("data.responded", is(true));
        given().contentType(ContentType.JSON).body("{\"clientId\":\"browser-1\",\"runId\":\"" + b + "\"}")
            .when().post(PUBLIC + "/" + id + "/responded").then().statusCode(200).body("data.responded", is(false));
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-1\",\"runId\":\"" + b + "\""))
            .when().post(submit).then().statusCode(201).body("data.sessionId", is(b));

        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-2\",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(201);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-3\",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(403);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"clientId\":\"browser-3\",\"runId\":\"" + b + "\""))
            .when().post(submit).then().statusCode(201);

        given().contentType(ContentType.JSON).body("{\"answers\":[]}")
            .when().post(PUBLIC + "/" + id + "/drafts").then().statusCode(409).body("code", is("RUN_REQUIRED"));
        String token = given().contentType(ContentType.JSON).body("{\"answers\":[],\"runId\":\"" + a + "\"}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200).body("data.runId", is(a)).extract().path("data.token");
        given().contentType(ContentType.JSON)
            .body("{\"token\":\"" + token + "\",\"answers\":[],\"runId\":\"" + b + "\"}")
            .when().post(PUBLIC + "/" + id + "/drafts")
            .then().statusCode(200).body("data.runId", is(b))
            .body("data.token", org.hamcrest.Matchers.not(token));
    }

    @Test
    @TestSecurity(user = OWNER)
    void snapshotKeepsRunContentWhileTheMasterChanges() throws Exception {
        String id = survey("{\"isQuiz\":true,\"allowMultipleResponses\":true}", question("%p", "Old title", "a", "b"));
        String p = id.substring(0, 8);
        String runId = run(id, "Exam", hoursFromNow(-1), hoursFromNow(1));

        given().when().get(PUBLIC + "/" + id + "?run=" + runId)
            .then().statusCode(200)
            .body("data.questions[0].title", is("Old title"))
            .body("data.questions[0].correctAnswers", nullValue());
        given().when().get(SURVEYS + "/" + id + "/runs").then().body("data[0].snapshotAt", notNullValue());

        save(id, "{\"isQuiz\":true,\"allowMultipleResponses\":true}", question(p, "New title", "a", "c"));

        given().when().get(PUBLIC + "/" + id + "?run=" + runId)
            .then().statusCode(200)
            .body("data.questions[0].title", is("Old title"))
            .body("data.questions[0].options.label", containsInAnyOrder("a", "b"));
        given().contentType(ContentType.JSON).body(answer(p, "b", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.sessionId", is(runId));
        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.score", is(1));
        given().contentType(ContentType.JSON).body(answer(p, "c", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(400);

        given().when().get(SURVEYS + "/" + id + "/results?session=" + runId)
            .then().statusCode(200)
            .body("data.totalResponses", is(2))
            .body("data.questions[0].title", is("Old title"))
            .body("data.questions[0].optionCounts.'b-" + p + "'", is(1));
        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200).body("data.questions[0].title", is("New title"));

        byte[] xlsx = given().when().get(SURVEYS + "/" + id + "/export/xlsx?session=" + runId)
            .then().statusCode(200).extract().asByteArray();
        try (var wb = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            var head = wb.getSheet("Responses").getRow(0);
            var titles = new ArrayList<String>();
            head.forEach(cell -> titles.add(cell.getStringCellValue()));
            assertTrue(titles.contains("Old title"), titles.toString());
            assertEquals(3, wb.getSheet("Responses").getPhysicalNumberOfRows());
        }

        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                "update survey_responses set score = 99 where survey_id = ?1")
            .setParameter(1, id).executeUpdate());
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"published\",\"settings\":{\"isQuiz\":true,\"allowMultipleResponses\":true},"
                + "\"questions\":[" + question(p, "New title", "a", "c").replace("\"points\":1", "\"points\":5") + "]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        given().when().get(SURVEYS + "/" + id + "/responses?session=" + runId)
            .then().statusCode(200)
            .body("data.score", containsInAnyOrder(0, 1))
            .body("data.maxScore", containsInAnyOrder(1, 1));
    }

    @Test
    @TestSecurity(user = OWNER)
    void shareLinkResolveServesTheRunSnapshot() {
        String id = survey("{}", question("%p", "Linked", "a", "b"));
        String runId = run(id, "Linked run", hoursFromNow(-1), hoursFromNow(1));
        String slug = given().when().get(SURVEYS + "/" + id + "/share-link")
            .then().statusCode(200).extract().path("data.slug");
        given().when().get("/api/v1/public/links/" + slug + "?run=" + runId)
            .then().statusCode(200)
            .body("data.run.id", is(runId))
            .body("data.runs[0].label", is("Linked run"))
            .body("data.questions[0].title", is("Linked"));
    }

    @Test
    @TestSecurity(user = OWNER)
    void surveysWithoutRunsAreUnchanged() {
        String id = survey("{}", question("%p", "Plain", "a", "b"));
        String p = id.substring(0, 8);
        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200).body("data.runs", hasSize(0)).body("data.hasRuns", is(false))
            .body("data.questions", hasSize(1));
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"whatever\""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.sessionId", nullValue());
        given().when().get(SURVEYS + "/" + id).then().statusCode(200).body("data.runs", nullValue());
    }

    @Test
    @TestSecurity(user = OWNER)
    void uploadsReferencedOnlyBySnapshotsAreKept() {
        byte[] png = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
        var image = storage.upload("run.png", "image/png", new ByteArrayInputStream(png), png.length);
        String id = given().contentType(ContentType.JSON).body("{\"title\":\"Runs\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"published\",\"description\":\"![x](" + image.url() + ")\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        String runId = run(id, "Pictured", hoursFromNow(-1), hoursFromNow(1));
        given().when().get(PUBLIC + "/" + id + "?run=" + runId).then().statusCode(200);
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"published\",\"description\":\"\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);

        cleanup.sweep(Instant.now().plusSeconds(60));

        var remaining = storage.uploads().map(StorageService.StoredObject::key).toList();
        assertTrue(remaining.contains(image.key()), "upload referenced by a run snapshot is kept");
    }

    @Test
    @TestSecurity(user = OWNER)
    void contentlessViewKeepsOnlySurveyLevelTranslations() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON)
            .body("{\"title\":\"Runs\",\"status\":\"published\",\"languages\":[\"en\",\"de\"],\"defaultLanguage\":\"en\","
                + "\"i18n\":{\"de\":{\"title\":\"Umfrage\",\"question:q-" + p + ":title\":\"Geheime Frage\","
                + "\"option:a-" + p + ":label\":\"Geheim\",\"section:s1:title\":\"Teil\"}},"
                + "\"questions\":[" + question(p, "Q", "a", "b") + "]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);
        run(id, "Later", hoursFromNow(5), hoursFromNow(6));

        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.questions", hasSize(0))
            .body("data.i18n.de.title", is("Umfrage"))
            .body("data.i18n.de.size()", is(1));
    }

    @Test
    @TestSecurity(user = OWNER)
    void liveResultsFollowTheOpenRunOnly() {
        String id = survey("{\"showLiveResults\":true,\"allowMultipleResponses\":true}", question("%p", "Old", "a", "b"));
        String p = id.substring(0, 8);
        String submit = SURVEYS + "/" + id + "/responses";
        run(id, "Later", hoursFromNow(5), hoursFromNow(6));
        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(403).body("code", is("NO_OPEN_RUN"));

        String first = run(id, "First", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body(answer(p, "a", "")).when().post(submit).then().statusCode(201);
        given().when().post(SURVEYS + "/" + id + "/runs/" + first + "/close").then().statusCode(200);
        run(id, "Second", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body(answer(p, "b", "")).when().post(submit).then().statusCode(201);
        save(id, "{\"showLiveResults\":true,\"allowMultipleResponses\":true}", question(p, "New", "a", "b"));

        given().when().get(PUBLIC + "/" + id + "/live-results")
            .then().statusCode(200)
            .body("data.totalResponses", is(1))
            .body("data.questions[0].title", is("Old"))
            .body("data.questions[0].optionCounts.'a-" + p + "'", is(0))
            .body("data.questions[0].optionCounts.'b-" + p + "'", is(1));
    }

    @Test
    @TestSecurity(user = OWNER)
    void capsRunsPerSurveyAndListsThemWithoutTheirSnapshot() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String open = run(id, "Open", hoursFromNow(-1), hoursFromNow(1));
        given().when().get(PUBLIC + "/" + id).then().statusCode(200).body("data.questions", hasSize(1));
        boolean loaded = QuarkusTransaction.requiringNew().call(() -> {
            var run = runRepository.findScheduled(id).get(0);
            return Hibernate.isPropertyInitialized(run, "snapshot");
        });
        assertFalse(loaded, "listing runs must not load their snapshot");
        assertTrue(QuarkusTransaction.requiringNew().call(() -> runRepository.findById(open).snapshot != null));

        QuarkusTransaction.requiringNew().run(() -> {
            for (int i = 1; i < 100; i++) {
                var run = new LiveSession();
                run.id = UUID.randomUUID().toString();
                run.surveyId = id;
                run.kind = LiveSession.SCHEDULED;
                run.label = "Run " + i;
                run.opensAt = hoursFromNow(10 + i);
                run.startedAt = run.opensAt;
                run.closesAt = hoursFromNow(11 + i);
                runRepository.persist(run);
            }
        });
        given().contentType(ContentType.JSON).body(runBody("One too many", hoursFromNow(500), hoursFromNow(501)))
            .when().post(SURVEYS + "/" + id + "/runs")
            .then().statusCode(409).body("code", is("RUN_LIMIT"));
        given().contentType(ContentType.JSON).body(runBody("Copy", hoursFromNow(500), hoursFromNow(501)))
            .when().post(SURVEYS + "/" + id + "/runs/" + open + "/duplicate")
            .then().statusCode(409).body("code", is("RUN_LIMIT"));
    }

    @Test
    @TestSecurity(user = OWNER)
    void accessCodeResolveHonoursTheRunParameter() {
        String id = survey("{}", question("%p", "Coded", "a", "b"));
        String a = run(id, "A", hoursFromNow(-1), hoursFromNow(1));
        run(id, "B", hoursFromNow(-1), hoursFromNow(1));
        String code = given().when().get(SURVEYS + "/" + id + "/access-code")
            .then().statusCode(200).extract().path("data.code");

        given().contentType(ContentType.JSON).body("{\"code\":\"" + code + "\"}")
            .when().post("/api/v1/public/access-code")
            .then().statusCode(200)
            .body("data.survey.questions", hasSize(0))
            .body("data.survey.runs", hasSize(2))
            .body("data.survey.hasRuns", is(true));
        given().contentType(ContentType.JSON).body("{\"code\":\"" + code + "\"}")
            .when().post("/api/v1/public/access-code?run=" + a)
            .then().statusCode(200)
            .body("data.survey.run.id", is(a))
            .body("data.survey.questions[0].title", is("Coded"));
    }

    @Test
    @TestSecurity(user = MEMBER)
    void readersSeeTheRunPicker() {
        String viewed = foreignSurvey(CollaboratorRole.VIEWER);
        given().when().get(SURVEYS + "/" + viewed + "/live/sessions").then().statusCode(200);
    }

    @Test
    @TestSecurity(user = OWNER)
    void optionQuotasCountPerRun() {
        String id = survey("{\"allowMultipleResponses\":true}", """
            {"id":"q-%p","type":"multiple-choice","title":"Slot","required":false,
             "options":[{"id":"a-%p","label":"a","capacity":1},{"id":"b-%p","label":"b"}]}
            """);
        String p = id.substring(0, 8);
        String submit = SURVEYS + "/" + id + "/responses";
        String a = run(id, "A", hoursFromNow(-1), hoursFromNow(1));
        String b = run(id, "B", hoursFromNow(-1), hoursFromNow(1));

        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(201);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + a + "\""))
            .when().post(submit).then().statusCode(409);
        given().when().get(PUBLIC + "/" + id + "?run=" + b)
            .then().statusCode(200).body("data.questions[0].options[0].used", is(0));
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + b + "\""))
            .when().post(submit).then().statusCode(201);
        given().when().get(PUBLIC + "/" + id + "?run=" + a)
            .then().statusCode(200).body("data.questions[0].options[0].used", is(1));
    }

    @Test
    @TestSecurity(user = OWNER)
    void theSurveyWindowStillBoundsItsRuns() {
        String id = survey("{\"closesAt\":\"2000-01-01T00:00:00Z\"}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        String runId = run(id, "Open", hoursFromNow(-1), hoursFromNow(1));
        given().when().get(PUBLIC + "/" + id + "?run=" + runId).then().statusCode(403);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + runId + "\""))
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(403);

        String later = survey("{\"opensAt\":\"" + hoursFromNow(48) + "\"}", question("%p", "Q", "a", "b"));
        run(later, "Open", hoursFromNow(-1), hoursFromNow(1));
        given().when().get(PUBLIC + "/" + later).then().statusCode(403);
    }

    @Test
    @TestSecurity(user = OWNER)
    void liveSurveysListOnlyTheirLiveSessions() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        run(id, "Leftover", hoursFromNow(-1), hoursFromNow(1));
        save(id, "{\"liveMode\":true}", question(id.substring(0, 8), "Q", "a", "b"));
        given().when().get(SURVEYS + "/" + id + "/live/sessions")
            .then().statusCode(200).body("data", hasSize(0));
    }

    @Test
    @TestSecurity(user = OWNER)
    void gradingAndAllRunsResultsUseSnapshotQuestions() throws Exception {
        String id = survey("{\"isQuiz\":true,\"allowMultipleResponses\":true}", question("%p", "Old question", "a", "b"));
        String p = id.substring(0, 8);
        String runId = run(id, "Exam", hoursFromNow(-1), hoursFromNow(1));
        String responseId = given().contentType(ContentType.JSON).body(answer(p, "b", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).body("data.sessionId", is(runId)).extract().path("data.id");
        save(id, "{\"isQuiz\":true,\"allowMultipleResponses\":true}", question(p + "x", "New question", "a", "b"));

        given().contentType(ContentType.JSON).body("{\"grades\":[{\"responseId\":\"" + responseId + "\",\"points\":1}]}")
            .when().put(SURVEYS + "/" + id + "/questions/q-" + p + "/grades")
            .then().statusCode(200).body("data[0].score", is(1));
        given().contentType(ContentType.JSON).body("{\"responseIds\":[\"" + responseId + "\"],\"feedback\":\"Close\"}")
            .when().put(SURVEYS + "/" + id + "/questions/q-" + p + "/feedback")
            .then().statusCode(200);

        given().when().get(SURVEYS + "/" + id + "/results")
            .then().statusCode(200)
            .body("data.questions.title", containsInAnyOrder("New question", "Old question"))
            .body("data.questions.find { it.title == 'Old question' }.optionCounts.'b-" + p + "'", is(1));
        byte[] xlsx = given().when().get(SURVEYS + "/" + id + "/export/xlsx")
            .then().statusCode(200).extract().asByteArray();
        try (var wb = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            var titles = new ArrayList<String>();
            wb.getSheet("Responses").getRow(0).forEach(cell -> titles.add(cell.getStringCellValue()));
            assertTrue(titles.contains("Old question") && titles.contains("New question"), titles.toString());
        }
    }

    @Test
    @TestSecurity(user = OWNER)
    void reportsRunsEvenWhenAllAreClosed() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String runId = run(id, "Done", hoursFromNow(-1), hoursFromNow(1));
        given().when().post(SURVEYS + "/" + id + "/runs/" + runId + "/close").then().statusCode(200);
        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.runs", hasSize(0))
            .body("data.hasRuns", is(true))
            .body("data.questions", hasSize(0));
    }

    @Test
    @TestSecurity(user = OWNER)
    void resultCodesFromBeforeTheFirstRunNeverRevealTheNextExam() {
        String settings = "{\"isQuiz\":true,\"studentResults\":true,\"resultsReleased\":true,\"allowMultipleResponses\":true}";
        String id = survey(settings, question("%p", "Last exam", "a", "b"));
        String p = id.substring(0, 8);
        String code = given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).extract().path("data.resultCode");

        save(id, settings, question(p, "Next exam question", "a", "b"));
        run(id, "Next exam", hoursFromNow(5), hoursFromNow(6));

        given().contentType(ContentType.JSON).body("{\"code\":\"" + code + "\"}")
            .when().post(PUBLIC + "/" + id + "/result")
            .then().statusCode(200).body("data.survey.questions", hasSize(0));
        given().when().get(SURVEYS + "/" + id + "/runs")
            .then().statusCode(200)
            .body("data", hasSize(2))
            .body("data.find { it.status == 'closed' }.responseCount", is(1))
            .body("data.find { it.status == 'closed' }.snapshotAt", nullValue());
    }

    private int used(String optionId) {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery(
                "select used from question_options where id = ?1")
            .setParameter(1, optionId).getSingleResult()).intValue());
    }

    @Test
    @TestSecurity(user = OWNER)
    void freezingReleasesSurveyWideQuotaSlots() {
        String id = survey("{\"allowMultipleResponses\":true}", """
            {"id":"q-%p","type":"multiple-choice","title":"Slot","required":false,
             "options":[{"id":"a-%p","label":"a","capacity":1},{"id":"b-%p","label":"b"}]}
            """);
        String p = id.substring(0, 8);
        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
        assertEquals(1, used("a-" + p));

        run(id, "Later", hoursFromNow(5), hoursFromNow(6));

        assertEquals(0, used("a-" + p));
    }

    @Test
    @TestSecurity(user = OWNER)
    void lateSessionlessResponsesJoinTheFrozenRunOnTheNextRunChange() {
        String id = survey("{\"allowMultipleResponses\":true}", """
            {"id":"q-%p","type":"multiple-choice","title":"Slot","required":false,
             "options":[{"id":"a-%p","label":"a","capacity":5},{"id":"b-%p","label":"b"}]}
            """);
        String p = id.substring(0, 8);
        String other = survey("{\"allowMultipleResponses\":true}", question("%p", "Other", "a", "b"));
        String submit = SURVEYS + "/" + id + "/responses";
        String late = given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(submit).then().statusCode(201).extract().path("data.id");
        String preview = given().contentType(ContentType.JSON).body(answer(p, "b", ""))
            .when().post(submit).then().statusCode(201).extract().path("data.id");
        String foreign = given().contentType(ContentType.JSON).body(answer(other.substring(0, 8), "a", ""))
            .when().post(SURVEYS + "/" + other + "/responses").then().statusCode(201).extract().path("data.id");
        String first = run(id, "First", hoursFromNow(5), hoursFromNow(6));
        String frozen = sessionOf(late);
        QuarkusTransaction.requiringNew().run(() -> {
            em.createNativeQuery("update survey_responses set session_id = null where survey_id = ?1")
                .setParameter(1, id).executeUpdate();
            em.createNativeQuery("update survey_responses set preview = true where id = ?1")
                .setParameter(1, preview).executeUpdate();
            em.createNativeQuery("update question_options set used = 1 where id = ?1")
                .setParameter(1, "a-" + p).executeUpdate();
        });

        given().contentType(ContentType.JSON).body(runBody("Copy", hoursFromNow(7), hoursFromNow(8)))
            .when().post(SURVEYS + "/" + id + "/runs/" + first + "/duplicate").then().statusCode(201);

        assertEquals(frozen, sessionOf(late));
        assertEquals(null, sessionOf(preview));
        assertEquals(null, sessionOf(foreign));
        assertEquals(0, used("a-" + p));
        given().when().get(SURVEYS + "/" + id + "/runs").then().statusCode(200).body("data", hasSize(3));
    }

    private String sessionOf(String responseId) {
        return QuarkusTransaction.requiringNew().call(() -> (String) em.createNativeQuery(
                "select session_id from survey_responses where id = ?1")
            .setParameter(1, responseId).getSingleResult());
    }

    @Test
    @TestSecurity(user = OWNER)
    void contentlessViewHidesSettingsTexts() {
        String id = survey("{\"confirmationMessage\":\"Answer is 42\",\"firstPageTitle\":\"Part 1: fractions\","
            + "\"firstPageDescription\":\"Q1 asks for 3/4\",\"redirectUrl\":\"https://example.com/answers\","
            + "\"submitAnotherLabel\":\"Again\"}", question("%p", "Q", "a", "b"));
        run(id, "Later", hoursFromNow(5), hoursFromNow(6));

        given().when().get(PUBLIC + "/" + id)
            .then().statusCode(200)
            .body("data.questions", hasSize(0))
            .body("data.settings.confirmationMessage", nullValue())
            .body("data.settings.firstPageTitle", nullValue())
            .body("data.settings.firstPageDescription", nullValue())
            .body("data.settings.redirectUrl", nullValue())
            .body("data.settings.submitAnotherLabel", nullValue());
    }

    @Test
    @TestSecurity(user = OWNER)
    void concurrentRunCreationRespectsTheCap() throws Exception {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        QuarkusTransaction.requiringNew().run(() -> {
            for (int i = 0; i < 99; i++) {
                var run = new LiveSession();
                run.id = UUID.randomUUID().toString();
                run.surveyId = id;
                run.kind = LiveSession.SCHEDULED;
                run.label = "Run " + i;
                run.opensAt = hoursFromNow(10 + i);
                run.startedAt = run.opensAt;
                run.closesAt = hoursFromNow(11 + i);
                runRepository.persist(run);
            }
        });
        int threads = 8;
        var pool = java.util.concurrent.Executors.newFixedThreadPool(threads);
        var start = new java.util.concurrent.CountDownLatch(1);
        var calls = new ArrayList<java.util.concurrent.Future<Integer>>();
        for (int i = 0; i < threads; i++) {
            int n = i;
            calls.add(pool.submit(() -> {
                start.await();
                return given().contentType(ContentType.JSON)
                    .body(runBody("Race " + n, hoursFromNow(500), hoursFromNow(501)))
                    .when().post(SURVEYS + "/" + id + "/runs").then().extract().statusCode();
            }));
        }
        start.countDown();
        int created = 0;
        for (var call : calls) if (call.get() == 201) created++;
        pool.shutdown();
        assertEquals(1, created);
        assertEquals(100L, (long) QuarkusTransaction.requiringNew().call(() -> runRepository.countScheduled(id)));
    }

    @Test
    @TestSecurity(user = OWNER)
    void editLinksCarryTheirRunAndValidateAgainstItsSnapshot() {
        String id = survey("{\"allowEditResponses\":true,\"allowMultipleResponses\":true}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        String runId = run(id, "A", hoursFromNow(-1), hoursFromNow(1));
        run(id, "B", hoursFromNow(-1), hoursFromNow(1));
        String token = given().contentType(ContentType.JSON).body(answer(p, "a", ",\"runId\":\"" + runId + "\""))
            .when().post(SURVEYS + "/" + id + "/responses")
            .then().statusCode(201).extract().path("data.editToken");
        save(id, "{\"allowEditResponses\":true,\"allowMultipleResponses\":true}", question(p, "Q", "a", "c"));

        given().when().get("/api/v1/public/responses/" + token)
            .then().statusCode(200).body("data.runId", is(runId));
        given().contentType(ContentType.JSON).body(answer(p, "c", ""))
            .when().put("/api/v1/public/responses/" + token).then().statusCode(400);
        given().contentType(ContentType.JSON).body(answer(p, "b", ""))
            .when().put("/api/v1/public/responses/" + token).then().statusCode(200);
    }

    @Test
    @TestSecurity(user = OWNER)
    void previewsIgnoreTheSurveyWideLimitOfARunSurvey() {
        String id = survey("{\"responseLimit\":1}", question("%p", "Q", "a", "b"));
        String p = id.substring(0, 8);
        run(id, "A", hoursFromNow(-1), hoursFromNow(1));
        given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
        given().contentType(ContentType.JSON).body(answer(p, "a", ",\"preview\":true"))
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201);
    }

    @Test
    @TestSecurity(user = OWNER)
    void quotaFollowsTheSessionKindNotTheCurrentLiveMode() {
        String id = survey("{\"allowMultipleResponses\":true}", """
            {"id":"q-%p","type":"multiple-choice","title":"Slot","required":false,
             "options":[{"id":"a-%p","label":"a","capacity":1},{"id":"b-%p","label":"b"}]}
            """);
        String p = id.substring(0, 8);
        String responseId = given().contentType(ContentType.JSON).body(answer(p, "a", ""))
            .when().post(SURVEYS + "/" + id + "/responses").then().statusCode(201).extract().path("data.id");
        given().when().get(PUBLIC + "/" + id).then().body("data.questions[0].options[0].used", is(1));
        String gameId = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var game = new LiveSession();
            game.id = gameId;
            game.surveyId = id;
            game.startedAt = Instant.now();
            runRepository.persist(game);
            em.createNativeQuery("update survey_responses set session_id = ?1 where id = ?2")
                .setParameter(1, gameId).setParameter(2, responseId).executeUpdate();
        });

        given().when().delete(SURVEYS + "/" + id + "/responses/" + responseId).then().statusCode(200);
        given().when().get(PUBLIC + "/" + id).then().body("data.questions[0].options[0].used", is(0));
    }

    @Test
    @TestSecurity(user = OWNER)
    void expiredShareLinkTakesNoSnapshot() {
        String id = survey("{}", question("%p", "Q", "a", "b"));
        String runId = run(id, "Open", hoursFromNow(-1), hoursFromNow(1));
        String slug = given().when().get(SURVEYS + "/" + id + "/share-link")
            .then().statusCode(200).extract().path("data.slug");
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                "update share_links set expires_at = '2000-01-01T00:00:00Z' where survey_id = ?1")
            .setParameter(1, id).executeUpdate());

        int status = given().when().get("/api/v1/public/links/" + slug + "?run=" + runId)
            .then().extract().statusCode();
        assertTrue(status >= 400, "expired link status " + status);
        assertTrue(QuarkusTransaction.requiringNew().call(() -> runRepository.findById(runId).snapshot == null));
    }
}
