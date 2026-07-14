package org.acme.resource;

import java.util.Map;

import org.acme.dto.ApiResponse;
import org.acme.repository.UserRepository;
import org.acme.service.DebugTools;
import org.acme.service.EmailService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Diagnostics for the current user's account email. */
@Path("/me/email")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class MeEmailResource {

    @Inject
    EmailService email;

    @Inject
    UserRepository users;

    @Inject
    DebugTools debug;

    @Inject
    SecurityIdentity identity;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    /**
     * Send a test email to the current user's account address using the
     * instance's SMTP settings. Gated by app.debug-tools-enabled and
     * rate-limited to 1/min per user.
     */
    @POST
    @Path("/test")
    public Response testEmail() {
        debug.ensureEnabled();
        debug.rateLimit(userId(), "test-email");
        var user = users.findByIdOptional(userId()).orElse(null);
        if (user == null || user.email == null || user.email.isBlank()) {
            return Response.ok(ApiResponse.error("No email address on file")).build();
        }
        boolean sent = email.sendTestEmail(user.email);
        return Response.ok(ApiResponse.ok(Map.of(
            "sent", sent,
            "email", user.email))).build();
    }
}
