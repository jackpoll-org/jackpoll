package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.ShareLinkDtos.ShareLinkDto;
import org.acme.dto.ShareLinkDtos.UpdateShareLinkRequest;
import org.acme.service.ShareLinkService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/surveys/{id}/share-link")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class ShareLinkResource {

    @Inject
    ShareLinkService shareLinkService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public ApiResponse<ShareLinkDto> get(@PathParam("id") String surveyId) {
        return ApiResponse.ok(shareLinkService.get(ownerId(), surveyId));
    }

    @POST
    @Path("/rotate")
    public ApiResponse<ShareLinkDto> rotate(@PathParam("id") String surveyId) {
        return ApiResponse.ok(shareLinkService.rotate(ownerId(), surveyId));
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<ShareLinkDto> update(@PathParam("id") String surveyId, @Valid UpdateShareLinkRequest req) {
        return ApiResponse.ok(shareLinkService.update(ownerId(), surveyId, req));
    }
}
