package org.acme.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** Access level of a survey collaborator (the owner is implicit, not stored). */
public enum CollaboratorRole {
    EDITOR("editor"),
    VIEWER("viewer");

    private final String json;

    CollaboratorRole(String json) {
        this.json = json;
    }

    @JsonValue
    public String json() {
        return json;
    }

    @JsonCreator
    public static CollaboratorRole fromJson(String value) {
        for (var r : values()) {
            if (r.json.equals(value)) return r;
        }
        throw new IllegalArgumentException("Unknown collaborator role: " + value);
    }
}
