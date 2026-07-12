package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.AccessCodeDtos.UpdateAccessCodeRequest;
import org.acme.service.AccessCodeService;

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
import jakarta.ws.rs.core.Response;

@Path("/surveys/{id}/access-code")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class AccessCodeResource {

    @Inject
    AccessCodeService accessCodeService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response get(@PathParam("id") String surveyId) {
        return Response.ok(ApiResponse.ok(accessCodeService.get(ownerId(), surveyId))).build();
    }

    @POST
    @Path("/rotate")
    public Response rotate(@PathParam("id") String surveyId) {
        return Response.ok(ApiResponse.ok(accessCodeService.rotate(ownerId(), surveyId))).build();
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") String surveyId, @Valid UpdateAccessCodeRequest req) {
        return Response.ok(
            ApiResponse.ok(accessCodeService.setRequireCode(ownerId(), surveyId, req.requireCode())))
            .build();
    }
}
