package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.service.CollabLinkService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Passwordless editing access via a collaboration-link slug (issue #22). */
@Path("/public/collab")
@Produces(MediaType.APPLICATION_JSON)
public class PublicCollabResource {

    @Inject
    CollabLinkService collabLinkService;

    @GET
    @Path("/{slug}")
    @PermitAll
    public Response resolve(@PathParam("slug") String slug) {
        return Response.ok(ApiResponse.ok(collabLinkService.resolve(slug))).build();
    }

    @PUT
    @Path("/{slug}")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response edit(@PathParam("slug") String slug, @Valid UpdateSurveyRequest req) {
        return Response.ok(ApiResponse.ok(collabLinkService.applyEdit(slug, req))).build();
    }
}
