package org.acme.resource;

import java.util.List;

import org.acme.dto.ApiResponse;
import org.acme.dto.RunDtos.RunDto;
import org.acme.dto.RunDtos.RunRequest;
import org.acme.service.RunService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/surveys/{id}/runs")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class RunResource {

    @Inject
    RunService runService;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public ApiResponse<List<RunDto>> list(@PathParam("id") String surveyId) {
        return ApiResponse.ok(runService.list(userId(), surveyId));
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@PathParam("id") String surveyId, @Valid @NotNull RunRequest req) {
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(runService.create(userId(), surveyId, req)))
            .build();
    }

    @PUT
    @Path("/{runId}")
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<RunDto> update(
        @PathParam("id") String surveyId, @PathParam("runId") String runId, @Valid @NotNull RunRequest req) {
        return ApiResponse.ok(runService.update(userId(), surveyId, runId, req));
    }

    @POST
    @Path("/{runId}/close")
    public ApiResponse<RunDto> close(@PathParam("id") String surveyId, @PathParam("runId") String runId) {
        return ApiResponse.ok(runService.close(userId(), surveyId, runId));
    }

    @POST
    @Path("/{runId}/duplicate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response duplicate(
        @PathParam("id") String surveyId, @PathParam("runId") String runId, @Valid @NotNull RunRequest req) {
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(runService.duplicate(userId(), surveyId, runId, req)))
            .build();
    }

    @DELETE
    @Path("/{runId}")
    public Response delete(@PathParam("id") String surveyId, @PathParam("runId") String runId) {
        runService.delete(userId(), surveyId, runId);
        return Response.noContent().build();
    }
}
