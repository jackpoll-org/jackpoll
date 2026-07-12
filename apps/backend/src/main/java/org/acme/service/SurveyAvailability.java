package org.acme.service;

import java.time.Instant;

import org.acme.entity.Survey;
import org.acme.exception.ForbiddenAccessException;

/**
 * Shared availability checks for accepting responses: a survey's close time
 * (issue #16's temporary surveys) and its response limit (issue #19). Used by
 * the submit path and every public resolve path so the closed state is
 * consistent everywhere.
 */
public final class SurveyAvailability {

    private SurveyAvailability() {}

    public static void ensureOpen(Survey survey, long currentResponseCount) {
        var settings = survey.settings;
        if (settings == null) return;

        // Scheduled opening (issue #39): reject before the open time.
        if (settings.opensAt != null && !settings.opensAt.isBlank()) {
            try {
                if (Instant.now().isBefore(Instant.parse(settings.opensAt))) {
                    throw new ForbiddenAccessException("This survey is not open yet.");
                }
            } catch (java.time.format.DateTimeParseException ignored) {
                // malformed → no open limit
            }
        }

        if (settings.closesAt != null && !settings.closesAt.isBlank()) {
            try {
                if (Instant.now().isAfter(Instant.parse(settings.closesAt))) {
                    throw new ForbiddenAccessException("This survey is closed.");
                }
            } catch (java.time.format.DateTimeParseException ignored) {
                // malformed → no date limit
            }
        }

        if (settings.responseLimit != null && settings.responseLimit > 0
            && currentResponseCount >= settings.responseLimit) {
            throw new ForbiddenAccessException(
                "This survey has reached its response limit.");
        }
    }
}
