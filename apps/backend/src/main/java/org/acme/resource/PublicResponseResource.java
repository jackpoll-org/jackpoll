package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.ResponseDtos.SubmitResponseRequest;
import org.acme.service.ResponseService;

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

/**
 * Public, token-scoped editing of an already-submitted response (issue #40).
 * The unguessable token authorizes access — no account required.
 */
@Path("/public/responses")
@Produces(MediaType.APPLICATION_JSON)
public class PublicResponseResource {

    @Inject
    ResponseService responseService;

    @GET
    @Path("/{token}")
    @PermitAll
    public Response getForEdit(@PathParam("token") String token) {
        return Response.ok(ApiResponse.ok(responseService.getForEdit(token))).build();
    }

    @PUT
    @Path("/{token}")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("token") String token,
                           @Valid SubmitResponseRequest req) {
        return Response.ok(ApiResponse.ok(responseService.updateForEdit(token, req))).build();
    }
}
