package org.acme.resource;

import java.util.Map;

import org.acme.dto.ApiResponse;
import org.acme.dto.DeviceDtos.RegisterDeviceRequest;
import org.acme.service.DebugTools;
import org.acme.service.PushService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Registers/unregisters the current user's push-notification devices. */
@Path("/me/devices")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class DeviceResource {

    @Inject
    PushService push;

    @Inject
    DebugTools debug;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response register(@Valid RegisterDeviceRequest req) {
        push.register(userId(), req.token(), req.platform(), req.p256dh(), req.auth());
        return Response.ok(ApiResponse.ok(Map.of("registered", true))).build();
    }

    /**
     * Diagnostics: send a test push to all of the current user's devices.
     * Gated by app.debug-tools-enabled and rate-limited to 1/min per user.
     */
    @POST
    @Path("/test-push")
    public Response testPush() {
        debug.ensureEnabled();
        debug.rateLimit(userId(), "test-push");
        int devices = push.sendTest(userId(), "Jackpoll",
            "🔔 Test notification from Jackpoll");
        return Response.ok(ApiResponse.ok(Map.of(
            "sent", devices > 0,
            "devices", devices))).build();
    }

    /**
     * The VAPID public key browsers need to create a Web Push subscription (#74).
     * {@code enabled} is false when Web Push isn't configured on this instance.
     */
    @GET
    @Path("/web-push-key")
    public Response webPushKey() {
        var key = push.webPushPublicKey().orElse(null);
        return Response.ok(ApiResponse.ok(Map.of(
            "enabled", key != null,
            "publicKey", key == null ? "" : key))).build();
    }

    @DELETE
    @Path("/{token}")
    public Response unregister(@PathParam("token") String token) {
        push.unregister(userId(), token);
        return Response.noContent().build();
    }
}
