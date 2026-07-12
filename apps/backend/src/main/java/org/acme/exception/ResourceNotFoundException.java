package org.acme.exception;

/** Thrown when a requested resource does not exist (or is not visible to the caller). */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
