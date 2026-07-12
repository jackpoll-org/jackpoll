package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.service.LivePresentService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Presenter controls for live mode (#) — owner drives the current question. */
@Path("/surveys/{id}/live")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class LiveResource {

    @Inject
    LivePresentService liveService;

    @Inject
    SecurityIdentity identity;

    /** Broadcast the presenter's current position to all participants. */
    @POST
    @Path("/state")
    public Response setState(@PathParam("id") String id, @Valid LiveStateRequest req) {
        liveService.setState(identity.getPrincipal().getName(), id, req.index(), req.phase());
        return Response.ok(ApiResponse.ok(null)).build();
    }

    /**
     * Participant lobby check-in (anonymous): announces the player's nickname so
     * the presenter's lobby can show who has joined. Rebroadcast to the room;
     * exposes nothing privileged.
     */
    @POST
    @Path("/join")
    @PermitAll
    public Response join(@PathParam("id") String id, @Valid JoinRequest req) {
        liveService.announceJoin(id, req.name());
        return Response.ok(ApiResponse.ok(null)).build();
    }

    public record LiveStateRequest(int index, @Size(max = 32) String phase) {}

    public record JoinRequest(@Size(max = 100) String name) {}
}
