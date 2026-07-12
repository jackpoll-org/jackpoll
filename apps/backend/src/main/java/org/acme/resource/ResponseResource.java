package org.acme.resource;

import java.util.List;

import java.time.LocalDate;

import org.acme.dto.ApiResponse;
import org.acme.dto.ResponseDtos.ResponseDto;
import org.acme.dto.ResponseDtos.SubmitResponseRequest;
import org.acme.service.ExportService;
import org.acme.service.ResponseService;
import org.acme.service.SurveyService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/surveys")
@Produces(MediaType.APPLICATION_JSON)
public class ResponseResource {

    private static final String XLSX_MEDIA_TYPE =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    @Inject
    ResponseService responseService;

    @Inject
    ExportService exportService;

    @Inject
    SurveyService surveyService;

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
    public Response submit(
        @PathParam("id") String id,
        @Valid SubmitResponseRequest req,
        @jakarta.ws.rs.HeaderParam("X-Forwarded-For") String forwardedFor,
        @jakarta.ws.rs.core.Context io.vertx.core.http.HttpServerRequest http
    ) {
        var created = responseService.submit(id, req, clientIp(forwardedFor, http));
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(created))
            .build();
    }

    /**
     * Real client IP for per-IP rate limiting. The reverse proxy (Traefik)
     * appends the true client address as the LAST X-Forwarded-For hop, so any
     * values a client injects sit to its left. Take the rightmost hop — NOT the
     * leftmost, which is attacker-controlled and would let a spoofed header mint
     * a fresh rate-limit bucket per request. Falls back to the socket peer.
     */
    private static String clientIp(String forwardedFor, io.vertx.core.http.HttpServerRequest http) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            return hops[hops.length - 1].trim();
        }
        return http != null && http.remoteAddress() != null
            ? http.remoteAddress().hostAddress()
            : null;
    }

    /** List individual responses (optional date range) — owner only. */
    @GET
    @Path("/{id}/responses")
    @Authenticated
    public Response list(
        @PathParam("id") String id,
        @QueryParam("from") String from,
        @QueryParam("to") String to,
        @QueryParam("preview") @jakarta.ws.rs.DefaultValue("false") boolean preview
    ) {
        List<ResponseDto> data = responseService.list(ownerId(), id, from, to, preview);
        var meta = new ApiResponse.Meta(data.size(), 0, data.size());
        return Response.ok(ApiResponse.ok(data, meta)).build();
    }

    /** Delete one response — owner only. */
    @DELETE
    @Path("/{id}/responses/{responseId}")
    @Authenticated
    public Response deleteResponse(
        @PathParam("id") String id,
        @PathParam("responseId") String responseId
    ) {
        responseService.deleteResponse(ownerId(), id, responseId);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    /** Clear all responses for a survey — owner only. */
    @DELETE
    @Path("/{id}/responses")
    @Authenticated
    public Response clearResponses(@PathParam("id") String id) {
        responseService.clearResponses(ownerId(), id);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    /** Delete just the preview/test submissions for a survey — owner only (#). */
    @DELETE
    @Path("/{id}/responses/preview")
    @Authenticated
    public Response deletePreview(@PathParam("id") String id) {
        long deleted = responseService.deletePreviewResponses(ownerId(), id);
        return Response.ok(ApiResponse.ok(deleted)).build();
    }

    /** Aggregated dashboard results — owner only. {@code preview=true} includes
     *  the builder's test submissions. */
    @GET
    @Path("/{id}/results")
    @Authenticated
    public Response results(
        @PathParam("id") String id,
        @QueryParam("preview") @jakarta.ws.rs.DefaultValue("false") boolean preview
    ) {
        return Response.ok(ApiResponse.ok(responseService.results(ownerId(), id, preview))).build();
    }

    /** Formatted Excel (.xlsx) export of responses — owner only (issue #32). */
    @GET
    @Path("/{id}/export/xlsx")
    @Authenticated
    @Produces(XLSX_MEDIA_TYPE)
    public Response exportXlsx(
        @PathParam("id") String id,
        @QueryParam("from") String from,
        @QueryParam("to") String to
    ) {
        byte[] bytes = exportService.toXlsx(ownerId(), id, from, to);
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
