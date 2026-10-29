package org.acme.resource;

import org.acme.dto.AccessCodeDtos.EnterCodeRequest;
import org.acme.dto.ApiResponse;
import org.acme.exception.RateLimitedException;
import org.acme.service.AccessCodeService;
import org.acme.service.RateLimiterService;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.vertx.core.http.HttpServerRequest;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Public entry by access code (issue #15). */
@Path("/public/access-code")
@Produces(MediaType.APPLICATION_JSON)
public class PublicAccessResource {

    @Inject
    AccessCodeService accessCodeService;

    @Inject
    RateLimiterService rateLimiter;

    @ConfigProperty(name = "survey.access-code.rate-limit.max", defaultValue = "600")
    int rateLimitMax;

    @ConfigProperty(name = "survey.access-code.rate-limit.window-seconds", defaultValue = "60")
    long rateLimitWindowSeconds;

    @POST
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response resolve(
        @Valid EnterCodeRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        String ip = ClientIp.of(forwardedFor, http);
        if (!rateLimiter.allow("access-code|" + (ip == null ? "unknown" : ip), rateLimitMax, rateLimitWindowSeconds)) {
            throw new RateLimitedException("Too many attempts. Please wait a moment and try again.");
        }
        return Response.ok(ApiResponse.ok(accessCodeService.resolve(req.code()))).build();
    }
}
