package org.acme.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Supported question types. JSON values mirror the frontend
 * {@code QuestionType} union in {@code survey-frontend/app/types/survey.ts}.
 */
public enum QuestionType {
    SHORT_ANSWER("short-answer"),
    LONG_ANSWER("long-answer"),
    MULTIPLE_CHOICE("multiple-choice"),
    CHECKBOXES("checkboxes"),
    DROPDOWN("dropdown"),
    MULTIPLE_CHOICE_GRID("multiple-choice-grid"),
    CHECKBOX_GRID("checkbox-grid"),
    FILE_UPLOAD("file-upload"),
    SLIDER("slider"),
    RATING("rating"),
    DATE("date"),
    RANKING("ranking"),
    RATING_GRID("rating-grid"),
    SIGNATURE("signature"),
    WORDCLOUD("wordcloud"),
    /** Text/image block between questions; takes no answer (public #7). */
    CONTENT("content");

    private final String json;

    QuestionType(String json) {
        this.json = json;
    }

    /** False for display-only blocks that never collect or score an answer. */
    public boolean isAnswerable() {
        return this != CONTENT;
    }

    @JsonValue
    public String json() {
        return json;
    }

    @JsonCreator
    public static QuestionType fromJson(String value) {
        for (var t : values()) {
            if (t.json.equals(value)) {
                return t;
            }
        }
        throw new IllegalArgumentException("Unknown question type: " + value);
    }
}
