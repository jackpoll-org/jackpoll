package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link SpamRejectedException} to 400 with a generic message. */
@Provider
public class SpamRejectedExceptionMapper implements ExceptionMapper<SpamRejectedException> {

    @Override
    public Response toResponse(SpamRejectedException exception) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
