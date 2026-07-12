package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.WebhookDtos.CreateWebhookRequest;
import org.acme.service.WebhookService;

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

/** Owner-managed outbound webhooks for a survey (issue #36). */
@Path("/surveys/{id}/webhooks")
@Produces(MediaType.APPLICATION_JSON)
@Authenticated
public class WebhookResource {

    @Inject
    WebhookService webhookService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list(@PathParam("id") String surveyId) {
        return Response.ok(ApiResponse.ok(webhookService.list(ownerId(), surveyId))).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@PathParam("id") String surveyId,
                           @Valid CreateWebhookRequest req) {
        var created = webhookService.create(ownerId(), surveyId, req);
        return Response.status(Response.Status.CREATED).entity(ApiResponse.ok(created)).build();
    }

    @DELETE
    @Path("/{webhookId}")
    public Response delete(@PathParam("id") String surveyId,
                           @PathParam("webhookId") String webhookId) {
        webhookService.delete(ownerId(), surveyId, webhookId);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    @POST
    @Path("/{webhookId}/test")
    public Response test(@PathParam("id") String surveyId,
                         @PathParam("webhookId") String webhookId) {
        return Response.ok(
            ApiResponse.ok(webhookService.test(ownerId(), surveyId, webhookId))).build();
    }
}
