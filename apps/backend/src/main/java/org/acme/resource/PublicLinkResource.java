package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.service.ShareLinkService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Resolves a public share-link slug to its survey (issue #16). */
@Path("/public/links")
@Produces(MediaType.APPLICATION_JSON)
public class PublicLinkResource {

    @Inject
    ShareLinkService shareLinkService;

    @GET
    @Path("/{slug}")
    @PermitAll
    public Response resolve(@PathParam("slug") String slug) {
        return Response.ok(ApiResponse.ok(shareLinkService.resolve(slug))).build();
    }
}
