package org.acme.exception;

/** Thrown when a user is authenticated but lacks permission for an action. */
public class ForbiddenAccessException extends RuntimeException {
    public ForbiddenAccessException(String message) {
        super(message);
    }
}
