package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.ResponseDtos.SubmitResponseRequest;
import org.acme.exception.RateLimitedException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.service.RateLimiterService;
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

    @Inject
    RateLimiterService rateLimiter;

    static final int EDITS_PER_HOUR = 30;

    private static final java.util.regex.Pattern TOKEN_SHAPE = java.util.regex.Pattern.compile("[0-9a-f]{64}");

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
        if (token == null || !TOKEN_SHAPE.matcher(token).matches()) {
            throw new ResourceNotFoundException("This edit link is not available.");
        }
        if (!rateLimiter.allow("response-edit|" + token, EDITS_PER_HOUR, 3600)) {
            throw new RateLimitedException("Too many changes to this response. Please wait a while and try again.");
        }
        return Response.ok(ApiResponse.ok(responseService.updateForEdit(token, req))).build();
    }
}
