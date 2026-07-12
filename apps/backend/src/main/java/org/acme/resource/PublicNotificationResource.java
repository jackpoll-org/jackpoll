package org.acme.resource;

import org.acme.service.EmailService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * One-click unsubscribe link target for owner notification emails (issue #24).
 * Opened from an email, so it returns a small plain-text page.
 */
@Path("/public/notifications")
public class PublicNotificationResource {

    @Inject
    EmailService emailService;

    @GET
    @Path("/unsubscribe/{surveyId}/{token}")
    @PermitAll
    @Produces(MediaType.TEXT_PLAIN)
    public Response unsubscribe(
        @PathParam("surveyId") String surveyId,
        @PathParam("token") String token
    ) {
        boolean ok = emailService.unsubscribe(surveyId, token);
        if (!ok) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity("This unsubscribe link is invalid or has expired.")
                .build();
        }
        return Response.ok(
            "You have been unsubscribed. You will no longer receive notifications "
            + "for this survey. You can re-enable them anytime in the survey settings.")
            .build();
    }
}
