package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.AuthDtos.DeleteAccountRequest;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.RateLimitedException;
import org.acme.repository.UserRepository;
import org.acme.service.GdprService;
import org.acme.service.KeycloakService;
import org.acme.service.RateLimiterService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

/** GDPR data-subject rights for the current user (#export, account deletion). */
@Path("/me")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class GdprResource {

    @Inject
    GdprService gdprService;

    @Inject
    SecurityIdentity identity;

    @Inject
    UserRepository users;

    @Inject
    KeycloakService keycloak;

    @Inject
    RateLimiterService rateLimiter;

    private String userId() {
        return identity.getPrincipal().getName();
    }

    /** Right of access / portability (Art. 15/20) — a downloadable JSON export. */
    @GET
    @Path("/export")
    public Response export() {
        var data = gdprService.export(userId());
        return Response.ok(data)
            .header("Content-Disposition", "attachment; filename=\"survey-school-data.json\"")
            .build();
    }

    /** Right to erasure (Art. 17) — delete the account and all its data, after re-entering the password. */
    @DELETE
    @Consumes(MediaType.APPLICATION_JSON)
    public Response deleteAccount(@Valid DeleteAccountRequest req) {
        if (!rateLimiter.allow("delete-me|" + userId(), 5, 900)) {
            throw new RateLimitedException("Too many attempts. Please wait a moment and try again.");
        }
        var email = users.findByIdOptional(userId()).map(u -> u.email).orElse(null);
        if (req == null || email == null || !keycloak.verifyPassword(email, req.password())) {
            throw new ForbiddenAccessException("The password is incorrect.");
        }
        gdprService.deleteAccount(userId());
        // Drop the refresh cookie — the session is gone.
        var cleared = new NewCookie.Builder("refresh_token")
            .value("").path("/").httpOnly(true).maxAge(0).build();
        return Response.ok(ApiResponse.ok(null)).cookie(cleared).build();
    }
}
