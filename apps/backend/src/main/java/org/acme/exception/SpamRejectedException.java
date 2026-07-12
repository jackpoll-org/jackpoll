package org.acme.exception;

/**
 * Thrown when a public submission fails a spam/bot heuristic (issue #31).
 * The message is intentionally generic so it leaks no detail to bots.
 */
public class SpamRejectedException extends RuntimeException {
    public SpamRejectedException(String message) {
        super(message);
    }
}
