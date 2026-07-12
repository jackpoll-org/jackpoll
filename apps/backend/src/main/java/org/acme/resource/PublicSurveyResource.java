package org.acme.resource;

import org.acme.dto.AnalyticsDtos.TrackRequest;
import org.acme.dto.ApiResponse;
import org.acme.dto.DraftDtos.SaveDraftRequest;
import org.acme.dto.SpamDtos.BeginResponse;
import org.acme.service.AnalyticsService;
import org.acme.service.DraftService;
import org.acme.service.ResponseService;
import org.acme.service.SpamProtectionService;
import org.acme.service.SurveyService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
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

    @GET
    @Path("/{id}")
    @PermitAll
    public Response getPublished(@PathParam("id") String id) {
        return Response.ok(ApiResponse.ok(surveyService.getPublished(id))).build();
    }

    /** Cookieless analytics beacon (issue #34) — view / start / submit. */
    @POST
    @Path("/{id}/track")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response track(@PathParam("id") String id, @Valid TrackRequest req) {
        analyticsService.track(id, req);
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/live-results")
    @PermitAll
    public Response liveResults(@PathParam("id") String id) {
        return Response.ok(ApiResponse.ok(responseService.liveResults(id))).build();
    }

    /** Save &amp; resume (issue #26): create or update an anonymous draft. */
    @POST
    @Path("/{id}/drafts")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response saveDraft(@PathParam("id") String id, @Valid SaveDraftRequest req) {
        return Response.ok(ApiResponse.ok(draftService.save(id, req))).build();
    }

    /** Spam protection (issue #31): issue a signed begin-token for the timing check. */
    @GET
    @Path("/{id}/begin")
    @PermitAll
    public Response begin(@PathParam("id") String id) {
        return Response.ok(
            ApiResponse.ok(new BeginResponse(spamProtection.issueBeginToken(id)))).build();
    }

    /** Spam protection (issue #31): Altcha proof-of-work challenge for the widget. */
    @GET
    @Path("/{id}/altcha")
    @PermitAll
    public Response altcha(@PathParam("id") String id) {
        // Altcha widgets expect the raw challenge object (no envelope).
        return Response.ok(spamProtection.createChallenge()).build();
    }
}
