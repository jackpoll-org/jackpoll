package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.acme.entity.OptionKind;
import org.acme.entity.Question;
import org.acme.entity.QuestionOption;
import org.acme.entity.QuestionType;
import org.acme.entity.Survey;
import org.junit.jupiter.api.Test;

class QuizPointsPerAnswerTest {

    private static Question question(QuestionType type, Integer points, List<String> correct, Map<String, Object> settings) {
        var q = bare(type, points, correct, settings);
        if (settings != null && settings.get("optionPoints") instanceof Map<?, ?> map) {
            for (var id : map.keySet()) {
                if ("gone".equals(id)) continue;
                var o = new QuestionOption();
                o.id = (String) id;
                o.kind = OptionKind.OPTION;
                q.options.add(o);
            }
        }
        return q;
    }

    private static Question bare(QuestionType type, Integer points, List<String> correct, Map<String, Object> settings) {
        var q = new Question();
        q.id = "q";
        q.type = type;
        q.points = points;
        q.correctAnswers = correct;
        q.settings = settings;
        q.options = new ArrayList<>();
        return q;
    }

    private static Question ranking(boolean scoreOrder, String... optionIds) {
        var q = bare(QuestionType.RANKING, 3, null, scoreOrder ? Map.of("scoreOrder", true) : null);
        for (int i = 0; i < optionIds.length; i++) {
            var o = new QuestionOption();
            o.id = optionIds[i];
            o.kind = OptionKind.OPTION;
            o.order = i;
            q.options.add(o);
        }
        return q;
    }

    @Test
    void singleChoiceGivesThePointsOfTheChosenOption() {
        var q = question(QuestionType.MULTIPLE_CHOICE, 1, List.of("b"),
            Map.of("optionPoints", Map.of("a", 0, "b", 2, "c", 0, "d", 1)));

        assertEquals(2, QuizScoring.autoPoints(q, "b"));
        assertEquals(1, QuizScoring.autoPoints(q, "d"));
        assertEquals(0, QuizScoring.autoPoints(q, "a"));
        assertEquals(2, QuizScoring.pointsFor(q));
    }

    @Test
    void multipleChoiceAddsTheChosenOptionsAndNeverDropsBelowZero() {
        var q = question(QuestionType.CHECKBOXES, 1, List.of("a", "c"),
            Map.of("optionPoints", Map.of("a", 1, "b", -1, "c", 1, "d", 0)));

        assertEquals(2, QuizScoring.autoPoints(q, List.of("a", "c")));
        assertEquals(1, QuizScoring.autoPoints(q, List.of("a", "c", "b")));
        assertEquals(0, QuizScoring.autoPoints(q, List.of("b")));
        assertEquals(2, QuizScoring.pointsFor(q));
    }

    @Test
    void optionPointsMakeAQuestionScorableWithoutAMarkedAnswer() {
        var q = question(QuestionType.CHECKBOXES, 1, List.of(), Map.of("optionPoints", Map.of("a", 1)));
        assertTrue(QuizScoring.isScorable(q));
        assertFalse(QuizScoring.isScorable(question(QuestionType.CHECKBOXES, 1, List.of(), Map.of("optionPoints", Map.of("a", 0)))));
    }

    @Test
    void shortAnswerGivesThePointsOfTheMatchedAnswer() {
        var q = question(QuestionType.SHORT_ANSWER, 2, List.of("Berlin", "Berlin, Germany"),
            Map.of("answerPoints", Map.of("Berlin, Germany", 1)));

        assertEquals(2, QuizScoring.autoPoints(q, " berlin "));
        assertEquals(1, QuizScoring.autoPoints(q, "berlin, germany"));
        assertEquals(0, QuizScoring.autoPoints(q, "Paris"));
        var blankOnly = question(QuestionType.SHORT_ANSWER, 2, List.of(" "), null);
        assertFalse(QuizScoring.isScorable(blankOnly));
        var withBlank = question(QuestionType.SHORT_ANSWER, 2, List.of("", "Rom"), null);
        assertEquals(0, QuizScoring.autoPoints(withBlank, ""));
        assertEquals(0, QuizScoring.autoPoints(withBlank, " "));
        assertEquals(2, QuizScoring.pointsFor(q));
    }

    @Test
    void rankingIsScoredOnlyWhenTheOwnerAsksForIt() {
        var scored = ranking(true, "x", "y", "z");
        assertTrue(QuizScoring.isScorable(scored));
        assertEquals(3, QuizScoring.autoPoints(scored, List.of("x", "y", "z")));
        assertEquals(0, QuizScoring.autoPoints(scored, List.of("y", "x", "z")));

        var opinion = ranking(false, "x", "y");
        assertFalse(QuizScoring.isScorable(opinion));
        assertEquals(0, QuizScoring.autoPoints(opinion, List.of("x", "y")));
    }

    @Test
    void ignoresPointsOfRemovedOptionsAndClampsExtremeValues() {
        var q = question(QuestionType.CHECKBOXES, 1, List.of(),
            Map.of("optionPoints", Map.of("a", 5_000_000_000L, "gone", 7)));

        assertEquals(1000, QuizScoring.pointsFor(q));
        assertEquals(1000, QuizScoring.autoPoints(q, List.of("a", "gone")));
    }

    @Test
    void maxScoreUsesTheDerivedPoints() {
        var s = new Survey();
        s.questions = List.of(
            question(QuestionType.CHECKBOXES, 9, List.of("a"), Map.of("optionPoints", Map.of("a", 1, "b", 1, "c", -1))),
            ranking(true, "x", "y"));
        assertEquals(5, QuizScoring.maxScore(s));
    }
}
