package org.acme.exception;

import java.util.List;

import org.acme.dto.RunDtos.PublicRunDto;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class RunExceptionMapper implements ExceptionMapper<RunException> {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RunErrorResponse(
        boolean success, String error, String code, String reason, List<PublicRunDto> runs, String nextOpensAt) {}

    @Override
    public Response toResponse(RunException exception) {
        return Response.status(exception.status)
            .entity(new RunErrorResponse(false, exception.getMessage(), exception.code, exception.code,
                exception.runs, exception.nextOpensAt))
            .build();
    }
}
