package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.service.DraftService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * Public resume endpoint for save &amp; resume drafts (issue #26). Drafts are
 * addressed by their unguessable token, so no authentication is required.
 */
@Path("/public/drafts")
@Produces(MediaType.APPLICATION_JSON)
public class PublicDraftResource {

    @Inject
    DraftService draftService;

    @GET
    @Path("/{token}")
    @PermitAll
    public Response resume(@PathParam("token") String token) {
        return Response.ok(ApiResponse.ok(draftService.get(token))).build();
    }

    @DELETE
    @Path("/{token}")
    @PermitAll
    public Response discard(@PathParam("token") String token) {
        draftService.delete(token);
        return Response.noContent().build();
    }
}
