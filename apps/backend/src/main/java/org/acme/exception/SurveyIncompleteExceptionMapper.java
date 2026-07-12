package org.acme.exception;

import org.acme.dto.ApiResponse;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

/** Maps {@link SurveyIncompleteException} to 422 with the standard envelope. */
@Provider
public class SurveyIncompleteExceptionMapper
    implements ExceptionMapper<SurveyIncompleteException> {

    @Override
    public Response toResponse(SurveyIncompleteException exception) {
        return Response.status(422)
            .entity(ApiResponse.error(exception.getMessage()))
            .build();
    }
}
