package org.acme.resource;

import java.util.List;

import org.acme.dto.ApiResponse;
import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.dto.CollaboratorDtos.CollaboratorDto;
import org.acme.service.CollaboratorService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/surveys/{id}/collaborators")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class CollaboratorResource {

    @Inject
    CollaboratorService collaboratorService;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list(@PathParam("id") String surveyId) {
        List<CollaboratorDto> data = collaboratorService.list(userId(), surveyId);
        return Response.ok(ApiResponse.ok(data)).build();
    }

    @POST
    public Response add(@PathParam("id") String surveyId, @Valid AddCollaboratorRequest req) {
        var created = collaboratorService.add(userId(), surveyId, req);
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(created))
            .build();
    }

    @DELETE
    @Path("/{userId}")
    public Response remove(
        @PathParam("id") String surveyId,
        @PathParam("userId") String collaboratorUserId
    ) {
        collaboratorService.remove(userId(), surveyId, collaboratorUserId);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
