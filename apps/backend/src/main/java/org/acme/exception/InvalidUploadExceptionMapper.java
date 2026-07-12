package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link InvalidUploadException} to 400 with the standard envelope. */
@Provider
public class InvalidUploadExceptionMapper implements ExceptionMapper<InvalidUploadException> {

    @Override
    public Response toResponse(InvalidUploadException exception) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
