package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link RateLimitedException} to 429 with a generic message. */
@Provider
public class RateLimitedExceptionMapper implements ExceptionMapper<RateLimitedException> {

    @Override
    public Response toResponse(RateLimitedException exception) {
        return Response.status(429)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
