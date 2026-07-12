package org.acme.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Supported question types. JSON values mirror the frontend
 * {@code QuestionType} union in {@code survey-frontend/app/types/survey.ts}.
 */
public enum QuestionType {
    SHORT_ANSWER("short-answer"),
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
    WORDCLOUD("wordcloud");

    private final String json;

    QuestionType(String json) {
        this.json = json;
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
