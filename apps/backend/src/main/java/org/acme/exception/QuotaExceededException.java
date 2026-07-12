package org.acme.exception;

/**
 * Thrown when a submission selects an option whose per-option quota is already
 * full (issue #38). The message is generic so it can be shown to respondents.
 */
public class QuotaExceededException extends RuntimeException {
    public QuotaExceededException(String message) {
        super(message);
    }
}
