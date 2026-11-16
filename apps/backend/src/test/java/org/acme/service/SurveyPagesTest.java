package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.acme.entity.Question;
import org.acme.entity.QuestionType;
import org.acme.entity.Section;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class SurveyPagesTest {

    private static Question question(String id, QuestionType type, String sectionId) {
        var q = new Question();
        q.id = id;
        q.type = type;
        q.sectionId = sectionId;
        return q;
    }

    private static Section section(String id, int order) {
        var s = new Section();
        s.id = id;
        s.title = "Title " + id;
        s.order = order;
        return s;
    }

    private static Survey survey(List<Question> questions, List<Section> sections, boolean conversational) {
        var s = new Survey();
        s.settings = new SurveySettings();
        s.settings.conversational = conversational;
        s.settings.firstPageTitle = "Start";
        s.questions = new ArrayList<>(questions);
        s.sections = sections;
        return s;
    }

    private static List<String> ids(List<Question> questions) {
        return questions.stream().map(q -> q.id).toList();
    }

    private final List<Question> questions = List.of(
        question("first-created", QuestionType.MULTIPLE_CHOICE, "p2"),
        question("info", QuestionType.CONTENT, "p1"),
        question("second-created", QuestionType.MULTIPLE_CHOICE, "p1"),
        question("ungrouped", QuestionType.MULTIPLE_CHOICE, null),
        question("blank", QuestionType.SHORT_ANSWER, ""),
        question("orphan", QuestionType.MULTIPLE_CHOICE, "gone"));

    @Test
    void ordersQuestionsLikeThePlayerPages() {
        var survey = survey(questions, List.of(section("p2", 1), section("p1", 0)), false);
        assertEquals(List.of("ungrouped", "blank", "info", "second-created", "first-created", "orphan"),
            ids(SurveyPages.questionsInPageOrder(survey)));
    }

    @Test
    void namesEachPageLikeThePlayer() {
        var pages = SurveyPages.pages(survey(questions, List.of(section("p2", 1), section("p1", 0)), false));
        assertEquals(4, pages.size());
        assertEquals("Start", pages.get(0).title());
        assertEquals("Title p1", pages.get(1).title());
        assertEquals("Title p2", pages.get(2).title());
        assertNull(pages.get(3).title());
        assertEquals(List.of("orphan"), ids(pages.get(3).questions()));
    }

    @Test
    void dropsSectionsWithoutQuestions() {
        var pages = SurveyPages.pages(survey(
            List.of(question("a", QuestionType.SHORT_ANSWER, "p1")),
            List.of(section("empty", 0), section("p1", 1)), false));
        assertEquals(1, pages.size());
        assertEquals("Title p1", pages.get(0).title());
    }

    @Test
    void keepsSurveyOrderWithoutSections() {
        var survey = survey(questions, null, false);
        assertEquals(ids(questions), ids(SurveyPages.questionsInPageOrder(survey)));
        assertEquals(1, SurveyPages.pages(survey).size());
    }

    @Test
    void conversationalSurveysShowOneQuestionPerPageInSurveyOrder() {
        var survey = survey(questions, List.of(section("p2", 1), section("p1", 0)), true);
        assertEquals(ids(questions), ids(SurveyPages.questionsInPageOrder(survey)));
        assertEquals(questions.size(), SurveyPages.pages(survey).size());
    }

    private static final Path FIXTURE =
        Path.of("../frontend/app/lib/survey/__tests__/fixtures/page-order.json");

    private static String text(JsonNode node, String field) {
        var value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static Survey fromFixture(JsonNode c) {
        var questions = new ArrayList<Question>();
        c.get("questions").forEach(q -> questions.add(question(text(q, "id"), QuestionType.SHORT_ANSWER, text(q, "sectionId"))));
        var sections = new ArrayList<Section>();
        c.get("sections").forEach(s -> sections.add(section(text(s, "id"), s.get("order").asInt())));
        return survey(questions, sections, c.get("conversational").asBoolean());
    }

    @TestFactory
    List<DynamicTest> matchesTheSharedPageOrderFixture() throws Exception {
        var cases = new ObjectMapper().readTree(FIXTURE.toFile());
        var tests = new ArrayList<DynamicTest>();
        cases.forEach(c -> tests.add(DynamicTest.dynamicTest(c.get("name").asText(), () -> {
            var expected = new ArrayList<String>();
            c.get("expected").forEach(id -> expected.add(id.asText()));
            var survey = fromFixture(c);
            assertEquals(expected, ids(SurveyPages.questionsInPageOrder(survey)));
            var placed = SurveyPages.pages(survey).stream().flatMap(p -> p.questions().stream()).toList();
            assertEquals(placed.size(), new HashSet<>(ids(placed)).size());
        })));
        return tests;
    }

    @Test
    void laysOutManyPagesInLinearTime() {
        int n = 50_000;
        var survey = new Survey();
        survey.settings = new SurveySettings();
        survey.sections = new ArrayList<>();
        survey.questions = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            survey.sections.add(section("s" + i, n - i));
            survey.questions.add(question("q" + i, QuestionType.SHORT_ANSWER, "s" + i));
        }
        var order = org.junit.jupiter.api.Assertions.assertTimeoutPreemptively(
            java.time.Duration.ofSeconds(2), () -> SurveyPages.questionsInPageOrder(survey));
        assertEquals("q" + (n - 1), order.get(0).id);
    }
}
