package org.acme.service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;

import org.acme.entity.Question;
import org.acme.entity.Survey;

/** Server-side quiz scoring (issue #10). Correct answers never leave the server. */
public final class QuizScoring {

    private QuizScoring() {}

    public static int pointsFor(Question q) {
        return q.points != null && q.points > 0 ? q.points : 1;
    }

    public static boolean isScorable(Question q) {
        return q.correctAnswers != null && !q.correctAnswers.isEmpty();
    }

    public static int maxScore(Survey survey) {
        return survey.questions.stream()
            .filter(QuizScoring::isScorable)
            .mapToInt(QuizScoring::pointsFor)
            .sum();
    }

    /**
     * Speed-adjust a correct answer's points for the live quiz (#): full points
     * for an instant answer, decaying linearly to half points at the buzzer, so
     * a correct answer is always worth at least half. {@code elapsedMs} is the
     * time from the question being revealed to the answer; {@code limitMs} the
     * per-question countdown.
     */
    public static int speedAdjusted(int basePoints, long elapsedMs, long limitMs) {
        if (limitMs <= 0) return basePoints;
        double ratio = Math.max(0.0, Math.min(1.0, (double) elapsedMs / limitMs));
        double factor = 1.0 - 0.5 * ratio; // 1.0 → 0.5 across the window
        return Math.max(1, (int) Math.round(basePoints * factor));
    }

    /** Total earned points for the given answers (questionId → value). */
    public static int score(Survey survey, Map<String, Object> answers) {
        int total = 0;
        for (var q : survey.questions) {
            if (isScorable(q) && isCorrect(q, answers.get(q.id))) {
                total += pointsFor(q);
            }
        }
        return total;
    }

    public static boolean isCorrect(Question q, Object value) {
        if (value == null) return false;
        var correct = q.correctAnswers;
        switch (q.type) {
            case MULTIPLE_CHOICE, DROPDOWN -> {
                return value instanceof String s && correct.contains(s);
            }
            case CHECKBOXES -> {
                if (!(value instanceof List<?> list)) return false;
                var selected = new HashSet<String>();
                for (var item : list) {
                    if (item instanceof String s) selected.add(s);
                }
                return selected.equals(new HashSet<>(correct));
            }
            case SHORT_ANSWER -> {
                if (!(value instanceof String s)) return false;
                var answer = s.trim();
                boolean caseSensitive = Boolean.TRUE.equals(q.caseSensitiveAnswers);
                return correct.stream()
                    .anyMatch(c -> caseSensitive ? c.trim().equals(answer) : c.trim().equalsIgnoreCase(answer));
            }
            case SLIDER, RATING -> {
                // Correct within an optional tolerance of the target number (#55/#77).
                if (!(value instanceof Number n)) return false;
                Double target = parseDouble(correct.get(0));
                if (target == null) return false;
                double tolerance = 0;
                if (q.settings != null && q.settings.get("tolerance") instanceof Number t) {
                    tolerance = t.doubleValue();
                }
                return Math.abs(n.doubleValue() - target) <= tolerance;
            }
            default -> {
                return false;
            }
        }
    }

    private static Double parseDouble(String s) {
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException | NullPointerException e) {
            return null;
        }
    }
}
