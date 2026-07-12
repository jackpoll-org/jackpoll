package org.acme.exception;

/** Thrown when an uploaded file fails validation (type, size, …). */
public class InvalidUploadException extends RuntimeException {
    public InvalidUploadException(String message) {
        super(message);
    }
}
