package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.exception.RateLimitedException;
import org.acme.service.CollabLinkService;
import org.acme.service.RateLimiterService;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.vertx.core.http.HttpServerRequest;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Passwordless editing access via a collaboration-link slug (issue #22). */
@Path("/public/collab")
@Produces(MediaType.APPLICATION_JSON)
public class PublicCollabResource {

    @Inject
    CollabLinkService collabLinkService;

    @Inject
    RateLimiterService rateLimiter;

    @ConfigProperty(name = "survey.collab-link.rate-limit.max", defaultValue = "120")
    int rateLimitMax;

    private void throttle(String forwardedFor, HttpServerRequest http) {
        String ip = ClientIp.of(forwardedFor, http);
        if (!rateLimiter.allow("collab-link|" + (ip == null ? "unknown" : ip), rateLimitMax, 60)) {
            throw new RateLimitedException("Too many requests. Please wait a moment and try again.");
        }
    }

    @GET
    @Path("/{slug}")
    @PermitAll
    public Response resolve(
        @PathParam("slug") String slug,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        throttle(forwardedFor, http);
        return Response.ok(ApiResponse.ok(collabLinkService.resolve(slug))).build();
    }

    @PUT
    @Path("/{slug}")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response edit(
        @PathParam("slug") String slug,
        @Valid UpdateSurveyRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        throttle(forwardedFor, http);
        return Response.ok(ApiResponse.ok(collabLinkService.applyEdit(slug, req))).build();
    }
}
