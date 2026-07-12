package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.service.GdprService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
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

    /** Right to erasure (Art. 17) — delete the account and all its data. */
    @DELETE
    public Response deleteAccount() {
        gdprService.deleteAccount(userId());
        // Drop the refresh cookie — the session is gone.
        var cleared = new NewCookie.Builder("refresh_token")
            .value("").path("/").httpOnly(true).maxAge(0).build();
        return Response.ok(ApiResponse.ok(null)).cookie(cleared).build();
    }
}
