package org.acme.exception;

/** Thrown when a client exceeds the submit rate limit (issue #31). */
public class RateLimitedException extends RuntimeException {
    public RateLimitedException(String message) {
        super(message);
    }
}
