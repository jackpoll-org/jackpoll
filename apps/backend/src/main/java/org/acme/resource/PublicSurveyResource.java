package org.acme.resource;

import org.acme.dto.AnalyticsDtos.TrackRequest;
import org.acme.dto.ApiResponse;
import org.acme.dto.DraftDtos.SaveDraftRequest;
import org.acme.dto.ResponseDtos.RespondedDto;
import org.acme.dto.ResponseDtos.RespondedRequest;
import org.acme.dto.ResponseDtos.ResultLookupRequest;
import org.acme.dto.SpamDtos.BeginResponse;
import org.acme.exception.RateLimitedException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.service.AccessCodeService;
import org.acme.service.AnalyticsService;
import org.acme.service.DraftService;
import org.acme.service.RateLimiterService;
import org.acme.service.ResponseService;
import org.acme.service.SpamProtectionService;
import org.acme.service.SurveyService;

import io.vertx.core.http.HttpServerRequest;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Public, unauthenticated read of published surveys (for embedding/filling). */
@Path("/public/surveys")
@Produces(MediaType.APPLICATION_JSON)
public class PublicSurveyResource {

    @Inject
    SurveyService surveyService;

    @Inject
    ResponseService responseService;

    @Inject
    AnalyticsService analyticsService;

    @Inject
    DraftService draftService;

    @Inject
    SpamProtectionService spamProtection;

    @Inject
    AccessCodeService accessCodes;

    @Inject
    RateLimiterService rateLimiter;

    private static final int RESULT_LOOKUPS_PER_MINUTE = 10;
    private static final int RESULT_MISSES_PER_HOUR = 60;
    private static final int RESULT_MISSES_PER_SURVEY_HOUR = 1000;

    @GET
    @Path("/{id}")
    @PermitAll
    public Response getPublished(@PathParam("id") String id) {
        accessCodes.requireAccess(id);
        return Response.ok(ApiResponse.ok(surveyService.getPublished(id))).build();
    }

    /** Cookieless analytics beacon (issue #34) — view / start / submit. */
    @POST
    @Path("/{id}/track")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response track(
        @PathParam("id") String id,
        @Valid TrackRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        rateLimiter.requirePublicWrite("track", id, ClientIp.of(forwardedFor, http));
        analyticsService.track(id, req);
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/live-results")
    @PermitAll
    public Response liveResults(
        @PathParam("id") String id,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        // Every call aggregates all responses, so it shares the anonymous budget.
        rateLimiter.requirePublicWrite("live-results", id, ClientIp.of(forwardedFor, http));
        accessCodes.requireAccess(id);
        return Response.ok(ApiResponse.ok(responseService.liveResults(id))).build();
    }

    /** Save &amp; resume (issue #26): create or update an anonymous draft. */
    @POST
    @Path("/{id}/drafts")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response saveDraft(
        @PathParam("id") String id,
        @Valid SaveDraftRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        rateLimiter.requirePublicWrite("draft", id, ClientIp.of(forwardedFor, http));
        accessCodes.requireAccess(id);
        return Response.ok(ApiResponse.ok(draftService.save(id, req))).build();
    }

    /** Spam protection (issue #31): issue a signed begin-token for the timing check. */
    @GET
    @Path("/{id}/begin")
    @PermitAll
    public Response begin(@PathParam("id") String id) {
        accessCodes.requireAccess(id);
        return Response.ok(
            ApiResponse.ok(new BeginResponse(spamProtection.issueBeginToken(id)))).build();
    }

    @POST
    @Path("/{id}/responded")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response responded(@PathParam("id") String id, @Valid @NotNull RespondedRequest req) {
        return Response.ok(ApiResponse.ok(
            new RespondedDto(responseService.hasResponded(id, req.clientId())))).build();
    }

    @POST
    @Path("/{id}/result")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response result(
        @PathParam("id") String id,
        @Valid @NotNull ResultLookupRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context HttpServerRequest http
    ) {
        var ip = ClientIp.of(forwardedFor, http);
        var missKey = "result-miss|" + id + "|" + ClientIp.bucket(ip);
        var surveyMissKey = "result-miss|" + id;
        if (!rateLimiter.allow("result-code|" + ClientIp.bucket(ip), RESULT_LOOKUPS_PER_MINUTE, 60)
            || rateLimiter.exhausted(missKey, RESULT_MISSES_PER_HOUR, 3600)
            || rateLimiter.exhausted(surveyMissKey, RESULT_MISSES_PER_SURVEY_HOUR, 3600)) {
            throw new RateLimitedException("Too many attempts. Please wait a moment and try again.");
        }
        try {
            return Response.ok(ApiResponse.ok(responseService.studentResult(id, req.code()))).build();
        } catch (ResourceNotFoundException e) {
            rateLimiter.allow(missKey, RESULT_MISSES_PER_HOUR, 3600);
            rateLimiter.allow(surveyMissKey, RESULT_MISSES_PER_SURVEY_HOUR, 3600);
            throw e;
        }
    }

    /** Spam protection (issue #31): Altcha proof-of-work challenge for the widget. */
    @GET
    @Path("/{id}/altcha")
    @PermitAll
    public Response altcha(@PathParam("id") String id) {
        // Altcha widgets expect the raw challenge object (no envelope).
        return Response.ok(spamProtection.createChallenge(id)).build();
    }
}
