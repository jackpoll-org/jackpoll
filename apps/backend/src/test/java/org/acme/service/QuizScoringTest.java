package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.acme.entity.Question;
import org.acme.entity.QuestionType;
import org.acme.entity.Survey;
import org.junit.jupiter.api.Test;

class QuizScoringTest {

    private Question q(String id, QuestionType type, Integer points, List<String> correct) {
        var question = new Question();
        question.id = id;
        question.type = type;
        question.points = points;
        question.correctAnswers = correct;
        return question;
    }

    private Survey survey(Question... questions) {
        var s = new Survey();
        s.questions = List.of(questions);
        return s;
    }

    @Test
    void isCorrect_sliderWithinTolerance() {
        var question = q("q1", QuestionType.SLIDER, 1, List.of("7"));
        question.settings = Map.of("tolerance", 1);
        assertTrue(QuizScoring.isCorrect(question, 7));
        assertTrue(QuizScoring.isCorrect(question, 8)); // within tolerance
        assertFalse(QuizScoring.isCorrect(question, 9)); // outside tolerance
        assertFalse(QuizScoring.isCorrect(question, "7")); // wrong value type
    }

    @Test
    void isCorrect_multipleChoice() {
        var question = q("q1", QuestionType.MULTIPLE_CHOICE, 2, List.of("optA"));
        assertTrue(QuizScoring.isCorrect(question, "optA"));
        assertFalse(QuizScoring.isCorrect(question, "optB"));
    }

    @Test
    void isCorrect_checkboxesRequiresExactSet() {
        var question = q("q1", QuestionType.CHECKBOXES, 1, List.of("a", "b"));
        assertTrue(QuizScoring.isCorrect(question, List.of("b", "a")));
        assertFalse(QuizScoring.isCorrect(question, List.of("a")));
        assertFalse(QuizScoring.isCorrect(question, List.of("a", "b", "c")));
    }

    @Test
    void partialCredit_correctChoicesAddWrongOnesSubtractNeverBelowZero() {
        var question = q("q1", QuestionType.CHECKBOXES, 3, List.of("a", "b", "c"));
        question.settings = Map.of("partialCredit", true);
        assertEquals(3, QuizScoring.autoPoints(question, List.of("a", "b", "c")));
        assertEquals(2, QuizScoring.autoPoints(question, List.of("a", "b")));
        assertEquals(1, QuizScoring.autoPoints(question, List.of("a", "b", "x")));
        assertEquals(0, QuizScoring.autoPoints(question, List.of("a", "x", "y")));
        assertEquals(0, QuizScoring.autoPoints(question, List.of("x")));
        assertEquals(2, QuizScoring.autoPoints(question, List.of("a", "a", "b")));
        assertEquals(0, QuizScoring.autoPoints(question, "a"));
        assertEquals(0, QuizScoring.autoPoints(question, null));
    }

    @Test
    void partialCredit_scalesToTheQuestionsPoints() {
        var question = q("q1", QuestionType.CHECKBOXES, 4, List.of("a", "b"));
        question.settings = Map.of("partialCredit", true);
        assertEquals(2, QuizScoring.autoPoints(question, List.of("a")));
        assertEquals(4, QuizScoring.autoPoints(question, List.of("a", "b")));
        assertEquals(2, QuizScoring.score(survey(question), Map.of("q1", List.of("a", "b", "z"))));
    }

    @Test
    void partialCredit_roundsDownSoFullPointsNeedACompleteAnswer() {
        var onePoint = q("q1", QuestionType.CHECKBOXES, 1, List.of("a", "b"));
        onePoint.settings = Map.of("partialCredit", true);
        assertEquals(0, QuizScoring.autoPoints(onePoint, List.of("a")));
        assertEquals(0, QuizScoring.autoPoints(onePoint, List.of("a", "b", "x")));
        assertEquals(1, QuizScoring.autoPoints(onePoint, List.of("a", "b")));

        var threePoints = q("q2", QuestionType.CHECKBOXES, 3, List.of("a", "b"));
        threePoints.settings = Map.of("partialCredit", true);
        assertEquals(1, QuizScoring.autoPoints(threePoints, List.of("a")));
        assertEquals(3, QuizScoring.autoPoints(threePoints, List.of("a", "b")));
    }

    @Test
    void withoutPartialCreditCheckboxesStayAllOrNothing() {
        var question = q("q1", QuestionType.CHECKBOXES, 3, List.of("a", "b", "c"));
        assertEquals(0, QuizScoring.autoPoints(question, List.of("a", "b")));
        assertEquals(3, QuizScoring.score(survey(question), Map.of("q1", List.of("c", "b", "a"))));
    }

    @Test
    void isCorrect_shortAnswerIsCaseInsensitive() {
        var question = q("q1", QuestionType.SHORT_ANSWER, 1, List.of("Paris"));
        assertTrue(QuizScoring.isCorrect(question, " paris "));
        assertFalse(QuizScoring.isCorrect(question, "London"));
    }

    @Test
    void scoreAndMaxScore_sumScorableQuestions() {
        var survey = survey(
            q("q1", QuestionType.MULTIPLE_CHOICE, 2, List.of("a")),
            q("q2", QuestionType.SHORT_ANSWER, 3, List.of("yes")),
            // not scorable (no correct answers) → ignored
            q("q3", QuestionType.SHORT_ANSWER, 5, null));

        assertEquals(5, QuizScoring.maxScore(survey));
        assertEquals(2, QuizScoring.score(survey, Map.of("q1", "a", "q2", "no")));
        assertEquals(5, QuizScoring.score(survey, Map.of("q1", "a", "q2", "YES")));
    }

    @Test
    void pointsDefaultToOneWhenUnset() {
        assertEquals(1, QuizScoring.pointsFor(q("q1", QuestionType.MULTIPLE_CHOICE, null, List.of("a"))));
    }

    @Test
    void speedAdjustedGivesFullForInstantAndHalfAtTheBuzzer() {
        long limit = 20_000;
        assertEquals(100, QuizScoring.speedAdjusted(100, 0, limit));      // instant → full
        assertEquals(75, QuizScoring.speedAdjusted(100, 10_000, limit));  // halfway → 75%
        assertEquals(50, QuizScoring.speedAdjusted(100, 20_000, limit));  // buzzer → half
        assertEquals(50, QuizScoring.speedAdjusted(100, 30_000, limit));  // late → clamped to half
        assertEquals(100, QuizScoring.speedAdjusted(100, 5_000, 0));      // no limit → unchanged
    }
}
