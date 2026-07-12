package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.NotificationPrefsDtos.NotificationPrefsRequest;
import org.acme.service.NotificationPrefsService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Account-level notification preferences (issue #89). */
@Path("/notification-preferences")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class NotificationPrefsResource {

    @Inject
    NotificationPrefsService service;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response get() {
        return Response.ok(ApiResponse.ok(service.get(ownerId()))).build();
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@Valid NotificationPrefsRequest req) {
        return Response.ok(ApiResponse.ok(service.update(ownerId(), req))).build();
    }
}
