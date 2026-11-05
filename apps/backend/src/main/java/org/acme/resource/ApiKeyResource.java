package org.acme.resource;

import org.acme.dto.ApiKeyDtos.CreateApiKeyRequest;
import org.acme.dto.ApiResponse;
import org.acme.service.ApiKeyService;

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

@Path("/me/api-keys")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class ApiKeyResource {

    @Inject
    ApiKeyService apiKeys;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list() {
        return Response.ok(ApiResponse.ok(apiKeys.list(userId()))).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@Valid @NotNull CreateApiKeyRequest req) {
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(apiKeys.create(userId(), req.name(), req.readResponses(), req.expiresInDays())))
            .build();
    }

    @DELETE
    @Path("/{keyId}")
    public Response delete(@PathParam("keyId") String keyId) {
        apiKeys.delete(userId(), keyId);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
