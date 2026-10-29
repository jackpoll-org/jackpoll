package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.RespondentTokenDtos.AddTokensRequest;
import org.acme.dto.RespondentTokenDtos.GenerateTokensRequest;
import org.acme.service.RespondentTokenService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/surveys/{id}/respondent-tokens")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class RespondentTokenResource {

    @Inject
    RespondentTokenService tokenService;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list(@PathParam("id") String surveyId) {
        return Response.ok(ApiResponse.ok(tokenService.list(userId(), surveyId))).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response add(@PathParam("id") String surveyId, @Valid @NotNull AddTokensRequest req) {
        return Response.ok(ApiResponse.ok(tokenService.add(userId(), surveyId, req.tokens()))).build();
    }

    @POST
    @Path("/generate")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response generate(@PathParam("id") String surveyId, @Valid @NotNull GenerateTokensRequest req) {
        return Response.ok(ApiResponse.ok(tokenService.generate(userId(), surveyId, req.count()))).build();
    }

    @DELETE
    @Path("/{tokenId}")
    public Response delete(@PathParam("id") String surveyId, @PathParam("tokenId") String tokenId) {
        tokenService.delete(userId(), surveyId, tokenId);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    @DELETE
    public Response deleteAll(@PathParam("id") String surveyId) {
        tokenService.deleteAll(userId(), surveyId);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
