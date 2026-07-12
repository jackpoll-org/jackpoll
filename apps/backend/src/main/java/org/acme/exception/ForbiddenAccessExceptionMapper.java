package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link ForbiddenAccessException} to 403 with the standard envelope. */
@Provider
public class ForbiddenAccessExceptionMapper implements ExceptionMapper<ForbiddenAccessException> {

    @Override
    public Response toResponse(ForbiddenAccessException exception) {
        return Response.status(Response.Status.FORBIDDEN)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
