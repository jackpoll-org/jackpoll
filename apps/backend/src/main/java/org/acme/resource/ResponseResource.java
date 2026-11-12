package org.acme.resource;

import java.util.List;

import java.time.LocalDate;

import org.acme.dto.ApiResponse;
import org.acme.dto.ResponseDtos.AnswerFeedbackRequest;
import org.acme.dto.ResponseDtos.GradeRequest;
import org.acme.dto.ResponseDtos.QuestionGradeRequest;
import org.acme.dto.ResponseDtos.ReviewRequest;
import org.acme.dto.ResponseDtos.ResponseDto;
import org.acme.dto.ResponseDtos.SubmitResponseRequest;
import org.acme.dto.ResponseDtos.SurveyResultsDto;
import org.acme.service.AccessCodeService;
import org.acme.service.CollabLinkService;
import org.acme.service.ExportService;
import org.acme.service.RateLimiterService;
import org.acme.service.ResponseService;
import org.acme.service.SurveyService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.jboss.resteasy.reactive.ResponseStatus;

@Path("/surveys")
@Produces(MediaType.APPLICATION_JSON)
public class ResponseResource {

    private static final String XLSX_MEDIA_TYPE =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Inject
    ResponseService responseService;

    @Inject
    AccessCodeService accessCodes;

    @Inject
    ExportService exportService;

    @Inject
    SurveyService surveyService;

    @Inject
    RateLimiterService rateLimiter;

    @Inject
    CollabLinkService collabLinks;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    /** Submit a response — public (anonymous respondents). */
    @POST
    @Path("/{id}/responses")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    @ResponseStatus(201)
    @APIResponse(responseCode = "201", description = "Created", content = @Content(schema = @Schema(ref = "ApiResponseResponseDto")))
    public ApiResponse<ResponseDto> submit(
        @PathParam("id") String id,
        @Valid SubmitResponseRequest req,
        @jakarta.ws.rs.HeaderParam("X-Forwarded-For") String forwardedFor,
        @jakarta.ws.rs.HeaderParam("X-Collab-Link") String collabLink,
        @jakarta.ws.rs.core.Context io.vertx.core.http.HttpServerRequest http
    ) {
        if (Boolean.TRUE.equals(req.preview()) && !id.equals(collabLinks.validSurveyId(collabLink))) {
            if (identity.isAnonymous()) {
                throw new org.acme.exception.ForbiddenAccessException("Sign in to preview this survey.");
            }
            surveyService.requireReadable(ownerId(), id);
        }
        String ip = ClientIp.of(forwardedFor, http);
        rateLimiter.requirePublicWrite("submit", id, ip);
        accessCodes.requireAccess(id);
        return ApiResponse.ok(responseService.submit(id, req, ip));
    }


    /** List individual responses (optional date range) — owner only. */
    @GET
    @Path("/{id}/responses")
    @Authenticated
    public ApiResponse<List<ResponseDto>> list(
        @PathParam("id") String id,
        @QueryParam("from") String from,
        @QueryParam("to") String to,
        @QueryParam("preview") @jakarta.ws.rs.DefaultValue("false") boolean preview,
        @QueryParam("session") String session
    ) {
        List<ResponseDto> data = responseService.list(ownerId(), id, from, to, preview, session);
        var meta = new ApiResponse.Meta(data.size(), 0, data.size());
        return ApiResponse.ok(data, meta);
    }

    /** Award points to manually graded answers (public #6) — owner/editors. */
    @PUT
    @Path("/{id}/responses/{responseId}/grades")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<ResponseDto> grade(
        @PathParam("id") String id,
        @PathParam("responseId") String responseId,
        @Valid @NotNull GradeRequest req
    ) {
        ResponseDto dto = responseService.grade(ownerId(), id, responseId, req.grades());
        return ApiResponse.ok(dto);
    }

    @PUT
    @Path("/{id}/questions/{questionId}/grades")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<List<ResponseDto>> gradeQuestion(
        @PathParam("id") String id,
        @PathParam("questionId") String questionId,
        @Valid @NotNull QuestionGradeRequest req
    ) {
        var graded = responseService.gradeQuestion(ownerId(), id, questionId, req.grades());
        return ApiResponse.ok(graded);
    }

    @PUT
    @Path("/{id}/questions/{questionId}/feedback")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<List<ResponseDto>> answerFeedback(
        @PathParam("id") String id,
        @PathParam("questionId") String questionId,
        @Valid @NotNull AnswerFeedbackRequest req
    ) {
        return ApiResponse.ok(
            responseService.answerFeedback(ownerId(), id, questionId, req.responseIds(), req.feedback()));
    }

    @PUT
    @Path("/{id}/responses/{responseId}/review")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<ResponseDto> review(
        @PathParam("id") String id,
        @PathParam("responseId") String responseId,
        @Valid @NotNull ReviewRequest req
    ) {
        ResponseDto dto = responseService.review(ownerId(), id, responseId, req.bonusPoints(), req.feedback());
        return ApiResponse.ok(dto);
    }

    /** Delete one response — owner only. */
    @DELETE
    @Path("/{id}/responses/{responseId}")
    @Authenticated
    public ApiResponse<Void> deleteResponse(
        @PathParam("id") String id,
        @PathParam("responseId") String responseId
    ) {
        responseService.deleteResponse(ownerId(), id, responseId);
        return ApiResponse.ok(null);
    }

    /** Clear all responses for a survey — owner only. */
    @DELETE
    @Path("/{id}/responses")
    @Authenticated
    public ApiResponse<Void> clearResponses(@PathParam("id") String id) {
        responseService.clearResponses(ownerId(), id);
        return ApiResponse.ok(null);
    }

    /** Delete just the preview/test submissions for a survey — owner only (#). */
    @DELETE
    @Path("/{id}/responses/preview")
    @Authenticated
    public ApiResponse<Long> deletePreview(@PathParam("id") String id) {
        long deleted = responseService.deletePreviewResponses(ownerId(), id);
        return ApiResponse.ok(deleted);
    }

    /** Aggregated dashboard results — owner only. {@code preview=true} includes
     *  the builder's test submissions; {@code session} narrows to one live quiz run. */
    @GET
    @Path("/{id}/results")
    @Authenticated
    public ApiResponse<SurveyResultsDto> results(
        @PathParam("id") String id,
        @QueryParam("preview") @jakarta.ws.rs.DefaultValue("false") boolean preview,
        @QueryParam("session") String session
    ) {
        return ApiResponse.ok(responseService.results(ownerId(), id, preview, session));
    }

    /** Formatted Excel (.xlsx) export of responses — owner only (issue #32). */
    @GET
    @Path("/{id}/export/xlsx")
    @Authenticated
    @Produces(XLSX_MEDIA_TYPE)
    public Response exportXlsx(
        @PathParam("id") String id,
        @QueryParam("from") String from,
        @QueryParam("to") String to,
        @QueryParam("session") String session
    ) {
        byte[] bytes = exportService.toXlsx(ownerId(), id, from, to, session);
        String title = surveyService.get(ownerId(), id).title();
        String filename = exportFilename(title);
        return Response.ok(bytes)
            .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
            .build();
    }

    /** Build a safe, dated file name: "<title>-responses-<date>.xlsx". */
    private static String exportFilename(String title) {
        String safe = (title == null || title.isBlank() ? "survey" : title)
            .replaceAll("[^a-zA-Z0-9-_]+", "_")
            .replaceAll("_+", "_");
        return safe + "-responses-" + LocalDate.now() + ".xlsx";
    }

    /** Branded PDF of one response — owner/editor/viewer only (issue #84). */
    @GET
    @Path("/{id}/responses/{responseId}/pdf")
    @Authenticated
    @Produces("application/pdf")
    public Response responsePdf(
        @PathParam("id") String id,
        @PathParam("responseId") String responseId
    ) {
        byte[] bytes = responseService.responsePdf(ownerId(), id, responseId);
        String title = surveyService.get(ownerId(), id).title();
        String safe = (title == null || title.isBlank() ? "survey" : title)
            .replaceAll("[^a-zA-Z0-9-_]+", "_").replaceAll("_+", "_");
        String filename = safe + "-response-" + LocalDate.now() + ".pdf";
        return Response.ok(bytes)
            .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
            .build();
    }
}
