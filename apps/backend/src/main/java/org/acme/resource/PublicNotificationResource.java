package org.acme.resource;

import org.acme.mail.MailCopy;
import org.acme.service.EmailService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Response;

/**
 * One-click unsubscribe link target for owner notification emails (issue #24).
 * Opened from an email, so it returns a small plain-text page.
 */
@Path("/public/notifications")
public class PublicNotificationResource {

    private static final MailCopy COPY = MailCopy.of("messages");

    @Inject
    EmailService emailService;

    @GET
    @Path("/unsubscribe/{surveyId}/{token}")
    @PermitAll
    @Produces("text/plain; charset=UTF-8")
    public Response unsubscribe(
        @PathParam("surveyId") String surveyId,
        @PathParam("token") String token,
        @HeaderParam("Accept-Language") String acceptLanguage
    ) {
        boolean ok = emailService.unsubscribe(surveyId, token);
        if (!ok) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(COPY.t(acceptLanguage, "unsubscribe.invalid"))
                .build();
        }
        return Response.ok(COPY.t(acceptLanguage, "unsubscribe.done")).build();
    }
}
