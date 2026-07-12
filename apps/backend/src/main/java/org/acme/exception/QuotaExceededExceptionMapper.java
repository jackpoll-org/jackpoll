package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link QuotaExceededException} to 409 Conflict. */
@Provider
public class QuotaExceededExceptionMapper implements ExceptionMapper<QuotaExceededException> {

    @Override
    public Response toResponse(QuotaExceededException exception) {
        return Response.status(Response.Status.CONFLICT)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
