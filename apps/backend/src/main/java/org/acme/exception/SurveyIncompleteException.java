package org.acme.exception;

/**
 * Thrown when a survey is published while still missing required content
 * (a question title, an answer option label). Drafts may be saved incomplete;
 * this only blocks the publish transition (#).
 */
public class SurveyIncompleteException extends RuntimeException {
    public SurveyIncompleteException(String message) {
        super(message);
    }
}
