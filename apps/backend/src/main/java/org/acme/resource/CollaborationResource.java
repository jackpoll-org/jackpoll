package org.acme.resource;

import java.util.List;

import org.acme.dto.ApiResponse;
import org.acme.dto.CollaboratorDtos.InvitationDto;
import org.acme.service.CollaboratorService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Invitee-facing collaboration endpoints (#8): list my pending invitations and
 * accept/decline them. Distinct from {@link CollaboratorResource}, which is the
 * owner managing a single survey's collaborators.
 */
@Path("/collaborations")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class CollaborationResource {

    @Inject
    CollaboratorService collaboratorService;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    @Path("/invitations")
    public Response invitations() {
        List<InvitationDto> data = collaboratorService.invitations(userId());
        return Response.ok(ApiResponse.ok(data)).build();
    }

    @POST
    @Path("/{surveyId}/accept")
    public Response accept(@PathParam("surveyId") String surveyId) {
        collaboratorService.accept(userId(), surveyId);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    @POST
    @Path("/{surveyId}/decline")
    public Response decline(@PathParam("surveyId") String surveyId) {
        collaboratorService.decline(userId(), surveyId);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
