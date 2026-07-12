package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.service.AnalyticsService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/surveys/{id}/analytics")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class AnalyticsResource {

    @Inject
    AnalyticsService analyticsService;

    @Inject
    SecurityIdentity identity;

    @GET
    public Response get(@PathParam("id") String surveyId) {
        var userId = identity.getPrincipal().getName();
        return Response.ok(ApiResponse.ok(analyticsService.getAnalytics(userId, surveyId))).build();
    }
}
