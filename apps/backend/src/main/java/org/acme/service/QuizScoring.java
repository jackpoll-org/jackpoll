package org.acme.service;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.acme.entity.OptionKind;
import org.acme.entity.Question;
import org.acme.entity.QuestionType;
import org.acme.entity.Survey;

/** Server-side quiz scoring (issue #10). Correct answers never leave the server. */
public final class QuizScoring {

    private static final Set<QuestionType> CHOICE =
        EnumSet.of(QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN, QuestionType.CHECKBOXES);

    private static final int POINTS_LIMIT = 1000;

    private QuizScoring() {}

    private static int basePoints(Question q) {
        return q.points != null && q.points > 0 ? q.points : 1;
    }

    public static int pointsFor(Question q) {
        var options = optionPoints(q);
        if (!options.isEmpty()) {
            var values = options.values().stream().mapToInt(Integer::intValue);
            int max = q.type == QuestionType.CHECKBOXES
                ? values.filter(p -> p > 0).sum()
                : values.max().orElse(0);
            return Math.max(0, max);
        }
        int base = basePoints(q);
        var answers = answerPoints(q);
        if (answers.isEmpty() || q.correctAnswers == null) return base;
        return q.correctAnswers.stream()
            .filter(c -> c != null && !c.isBlank())
            .mapToInt(c -> answers.getOrDefault(c, base))
            .max()
            .orElse(base);
    }

    public static Integer respondentPoints(Question q) {
        return optionPoints(q).isEmpty() && answerPoints(q).isEmpty() ? q.points : Integer.valueOf(pointsFor(q));
    }

    public static boolean isScorable(Question q) {
        return (q.correctAnswers != null && q.correctAnswers.stream().anyMatch(c -> c != null && !c.isBlank()))
            || optionPoints(q).values().stream().anyMatch(p -> p > 0)
            || scoresOrder(q);
    }

    public static boolean scoresOrder(Question q) {
        return q.type == QuestionType.RANKING && q.settings != null
            && Boolean.TRUE.equals(q.settings.get("scoreOrder"));
    }

    private static Map<String, Integer> optionPoints(Question q) {
        if (!CHOICE.contains(q.type)) return Map.of();
        var points = pointsMap(q, "optionPoints", -POINTS_LIMIT);
        var optionIds = new HashSet<String>();
        for (var o : q.options) {
            if (o.kind == OptionKind.OPTION) optionIds.add(o.id);
        }
        points.keySet().retainAll(optionIds);
        return points;
    }

    private static Map<String, Integer> answerPoints(Question q) {
        return q.type == QuestionType.SHORT_ANSWER ? pointsMap(q, "answerPoints", 0) : Map.of();
    }

    private static Map<String, Integer> pointsMap(Question q, String key, int min) {
        if (q.settings == null || !(q.settings.get(key) instanceof Map<?, ?> raw)) return new HashMap<>();
        var out = new HashMap<String, Integer>();
        raw.forEach((k, v) -> {
            if (k instanceof String id && v instanceof Number n) {
                out.put(id, (int) Math.max(min, Math.min(POINTS_LIMIT, n.longValue())));
            }
        });
        return out;
    }

    /**
     * Answers a teacher grades by hand (public #6): paragraphs always, and
     * short-answer / file-upload questions without an answer key when the
     * owner turned on {@code settings.manualGrading}.
     */
    public static boolean isManuallyGraded(Question q) {
        if (q.type == QuestionType.LONG_ANSWER) return true;
        if (isScorable(q)) return false;
        boolean optedIn = q.settings != null && Boolean.TRUE.equals(q.settings.get("manualGrading"));
        return optedIn && (q.type == QuestionType.SHORT_ANSWER || q.type == QuestionType.FILE_UPLOAD);
    }

    public static int maxScore(Survey survey) {
        return survey.questions.stream()
            .filter(q -> isScorable(q) || isManuallyGraded(q))
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
            total += autoPoints(q, answers.get(q.id));
        }
        return total;
    }

    public static boolean usesPartialCredit(Question q) {
        return q.type == QuestionType.CHECKBOXES && q.settings != null
            && Boolean.TRUE.equals(q.settings.get("partialCredit"));
    }

    public static int autoPoints(Question q, Object value) {
        if (!isScorable(q)) return 0;
        var options = optionPoints(q);
        if (!options.isEmpty()) return choicePoints(q, options, value);
        if (usesPartialCredit(q)) return partialCredit(q, value);
        var answers = answerPoints(q);
        if (!answers.isEmpty()) {
            int base = basePoints(q);
            return matchedAnswer(q, value).map(c -> answers.getOrDefault(c, base)).orElse(0);
        }
        return isCorrect(q, value) ? pointsFor(q) : 0;
    }

    private static int choicePoints(Question q, Map<String, Integer> options, Object value) {
        if (value instanceof String s) return Math.max(0, options.getOrDefault(s, 0));
        if (!(value instanceof List<?> list)) return 0;
        var selected = new HashSet<String>();
        for (var item : list) {
            if (item instanceof String s) selected.add(s);
        }
        int sum = selected.stream().mapToInt(id -> options.getOrDefault(id, 0)).sum();
        return Math.max(0, Math.min(sum, pointsFor(q)));
    }

    private static Optional<String> matchedAnswer(Question q, Object value) {
        if (!(value instanceof String s) || q.correctAnswers == null) return Optional.empty();
        var answer = s.trim();
        boolean caseSensitive = Boolean.TRUE.equals(q.caseSensitiveAnswers);
        return q.correctAnswers.stream()
            .filter(c -> c != null && !c.isBlank())
            .filter(c -> caseSensitive ? c.trim().equals(answer) : c.trim().equalsIgnoreCase(answer))
            .findFirst();
    }

    private static int partialCredit(Question q, Object value) {
        if (!(value instanceof List<?> list)) return 0;
        var correct = new HashSet<>(q.correctAnswers);
        var selected = new HashSet<String>();
        for (var item : list) {
            if (item instanceof String s) selected.add(s);
        }
        int hits = 0;
        int misses = 0;
        for (var s : selected) {
            if (correct.contains(s)) hits++;
            else misses++;
        }
        int net = Math.max(0, hits - misses);
        return pointsFor(q) * net / correct.size();
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
                return matchedAnswer(q, value).isPresent();
            }
            case RANKING -> {
                if (!scoresOrder(q) || !(value instanceof List<?> list)) return false;
                var order = q.options.stream()
                    .filter(o -> o.kind == OptionKind.OPTION)
                    .map(o -> o.id)
                    .toList();
                return list.equals(order);
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
