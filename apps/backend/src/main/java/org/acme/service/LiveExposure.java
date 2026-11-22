package org.acme.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.acme.entity.Question;
import org.acme.entity.Survey;
import org.acme.entity.SurveyResponse;

public final class LiveExposure {

    private LiveExposure() {}

    public static boolean allowed(Survey survey, Question q) {
        if (survey.settings == null || !survey.settings.sharesLiveResults()) return false;
        return exposable(survey.settings.isQuiz, survey.settings.postSubmitCombinedWordcloud, q);
    }

    public static boolean exposable(boolean isQuiz, boolean combined, Question q) {
        if (combined && !shownAsWordcloud(isQuiz, q)) return false;
        if (!q.type.isAnswerable() || (isQuiz && QuizScoring.scoresOrder(q))) return false;
        return switch (q.type) {
            case SHORT_ANSWER, LONG_ANSWER, FILE_UPLOAD, SIGNATURE, DATE -> false;
            default -> q.showInLiveResults == null || q.showInLiveResults;
        };
    }

    public static boolean widens(boolean quizBefore, Question before, boolean quizAfter, Question after) {
        return widensIn(false, quizBefore, before, quizAfter, after) || widensIn(true, quizBefore, before, quizAfter, after);
    }

    private static boolean widensIn(boolean combined, boolean quizBefore, Question before, boolean quizAfter, Question after) {
        return exposable(quizAfter, combined, after) && !exposable(quizBefore, combined, before);
    }

    private static boolean shownAsWordcloud(boolean isQuiz, Question q) {
        return switch (q.type) {
            case WORDCLOUD -> true;
            case MULTIPLE_CHOICE, DROPDOWN, CHECKBOXES ->
                q.settings != null && "wordcloud".equals(q.settings.get("resultChart"))
                    && !(isQuiz && QuizScoring.isScorable(q));
            default -> false;
        };
    }

    public static Question copyOf(Question q) {
        var copy = new Question();
        copy.id = q.id;
        copy.type = q.type;
        copy.settings = q.settings == null ? null : new HashMap<>(q.settings);
        copy.showInLiveResults = q.showInLiveResults;
        copy.correctAnswers = q.correctAnswers;
        copy.options = new ArrayList<>(q.options);
        return copy;
    }

    static final java.time.Duration TYPE_CHANGE_GRACE = java.time.Duration.ofMinutes(1);

    public static List<SurveyResponse> answeredSince(Question current, Question shown, List<SurveyResponse> responses) {
        if (current == null || current.typeChangedAt == null || current.type != shown.type) return responses;
        var since = current.typeChangedAt.plus(TYPE_CHANGE_GRACE);
        return responses.stream().filter(r -> !answeredAt(r).isBefore(since)).toList();
    }

    private static Instant answeredAt(SurveyResponse r) {
        return r.editedAt != null && r.editedAt.isAfter(r.submittedAt) ? r.editedAt : r.submittedAt;
    }
}
