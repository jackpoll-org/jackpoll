package org.acme.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Lifecycle status of a survey. JSON values mirror the frontend
 * {@code Survey['status']} union ({@code draft | published | closed}).
 */
public enum SurveyStatus {
    DRAFT("draft"),
    PUBLISHED("published"),
    CLOSED("closed");

    private final String json;

    SurveyStatus(String json) {
        this.json = json;
    }

    @JsonValue
    public String json() {
        return json;
    }

    @JsonCreator
    public static SurveyStatus fromJson(String value) {
        for (var s : values()) {
            if (s.json.equals(value)) {
                return s;
            }
        }
        throw new IllegalArgumentException("Unknown survey status: " + value);
    }
}
