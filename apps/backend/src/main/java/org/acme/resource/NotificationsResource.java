package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.NotificationDtos.UnreadCountDto;
import org.acme.exception.ResourceNotFoundException;
import org.acme.service.NotificationsService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** The in-app notification center (issue #89). */
@Path("/notifications")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class NotificationsResource {

    @Inject
    NotificationsService service;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list(
        @QueryParam("page") @DefaultValue("0") int page,
        @QueryParam("limit") @DefaultValue("20") int limit) {
        var result = service.list(userId(), page, limit);
        return Response.ok(
            ApiResponse.ok(result.items(), new ApiResponse.Meta(result.total(), page, limit))
        ).build();
    }

    @GET
    @Path("/unread-count")
    public Response unreadCount() {
        return Response.ok(ApiResponse.ok(new UnreadCountDto(service.unreadCount(userId())))).build();
    }

    @PUT
    @Path("/{id}/read")
    public Response markRead(@PathParam("id") String id) {
        if (!service.markRead(userId(), id)) {
            throw new ResourceNotFoundException("Notification not found: " + id);
        }
        return Response.ok(ApiResponse.ok(null)).build();
    }

    @PUT
    @Path("/read-all")
    public Response markAllRead() {
        service.markAllRead(userId());
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
