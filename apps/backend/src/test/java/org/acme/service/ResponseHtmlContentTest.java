package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.acme.entity.Question;
import org.acme.entity.QuestionType;
import org.acme.entity.Section;
import org.acme.entity.Survey;
import org.acme.entity.SurveyResponse;
import org.acme.entity.SurveySettings;
import org.junit.jupiter.api.Test;

class ResponseHtmlContentTest {

    private static Question question(String id, QuestionType type, String title, String description, String sectionId) {
        var q = new Question();
        q.id = id;
        q.type = type;
        q.title = title;
        q.description = description;
        q.sectionId = sectionId;
        return q;
    }

    private static Section section(String id, String title, String description, int order) {
        var s = new Section();
        s.id = id;
        s.title = title;
        s.description = description;
        s.order = order;
        return s;
    }

    private static String render(List<Question> questions, List<Section> sections) {
        var survey = new Survey();
        survey.title = "Survey";
        survey.settings = new SurveySettings();
        survey.questions = new ArrayList<>(questions);
        survey.sections = sections;
        return new ResponseService().buildResponseHtml(survey, new SurveyResponse());
    }

    private static int count(String html, String needle) {
        return html.split(java.util.regex.Pattern.quote(needle), -1).length - 1;
    }

    @Test
    void skipsBlankPageHeadings() {
        var html = render(
            List.of(question("a", QuestionType.SHORT_ANSWER, "A", null, "s1"),
                question("b", QuestionType.SHORT_ANSWER, "B", null, "s2")),
            List.of(section("s1", "  ", " ", 0), section("s2", "", "", 1)));
        assertFalse(html.contains("<h2>"), html);
        assertFalse(html.contains("class=\"pd\""), html);
    }

    @Test
    void anEmptyContentBlockRendersNothing() {
        var html = render(List.of(
            question("info", QuestionType.CONTENT, " ", "  ", null),
            question("a", QuestionType.SHORT_ANSWER, "A", null, null)), List.of());
        assertEquals(1, count(html, "class=\"q\""), html);
    }

    @Test
    void contentBlocksPrintPlainTextWithoutMarkdownOrPipingTokens() {
        var html = render(List.of(
            question("info", QuestionType.CONTENT, "Hello {{name}}",
                "## Welcome **friend**\n\n- one _item_\n1. [a link](https://example.com)\n> `quoted` {{ x-1 }} <b>",
                null)), List.of());
        assertTrue(html.contains("Hello </div>"), html);
        assertTrue(html.contains("Welcome friend\n\n• one item\n1. a link\nquoted  &lt;b&gt;"), html);
        assertFalse(html.contains("{{"), html);
        assertFalse(html.contains("**") || html.contains("##") || html.contains("]("), html);
    }

    @Test
    void aContentBlockWithOnlyATitleHasNoEmptyBody() {
        var html = render(List.of(question("info", QuestionType.CONTENT, "Just a title", null, null)), List.of());
        assertTrue(html.contains("Just a title"), html);
        assertFalse(html.contains("class=\"qa\""), html);
    }
}
