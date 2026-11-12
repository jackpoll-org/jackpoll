package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.service.SurveyService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.jboss.resteasy.reactive.ResponseStatus;

@Path("/surveys")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SurveyResource {

    @Inject
    SurveyService surveyService;

    @Inject
    SecurityIdentity identity;

    @Inject
    org.acme.security.ApiKeyGuard apiKeyGuard;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public ApiResponse<List<SurveyDto>> list(
        @QueryParam("page") @DefaultValue("0") @Min(0) int page,
        @QueryParam("limit") @DefaultValue("20") @Min(1) @Max(100) int limit
    ) {
        var owner = ownerId();
        var data = surveyService.list(owner, page, limit);
        var meta = new ApiResponse.Meta(surveyService.count(owner), page, limit);
        return ApiResponse.ok(data, meta);
    }

    @GET
    @Path("/{id}")
    public ApiResponse<SurveyDto> get(@PathParam("id") String id) {
        return ApiResponse.ok(surveyService.get(ownerId(), id));
    }

    @POST
    @ResponseStatus(201)
    @APIResponse(responseCode = "201", description = "Created", content = @Content(schema = @Schema(ref = "ApiResponseSurveyDto")))
    public ApiResponse<SurveyDto> create(@Valid CreateSurveyRequest req) {
        return ApiResponse.ok(surveyService.create(ownerId(), req));
    }

    @PUT
    @Path("/{id}")
    public ApiResponse<SurveyDto> update(@PathParam("id") String id, @Valid UpdateSurveyRequest req) {
        apiKeyGuard.checkUpdate(ownerId(), id, req.settings());
        return ApiResponse.ok(surveyService.update(ownerId(), id, req));
    }

    /** Lightweight tags/folder update from the dashboard (issue #33). */
    @PUT
    @Path("/{id}/organize")
    public ApiResponse<SurveyDto> organize(
        @PathParam("id") String id,
        org.acme.dto.SurveyDtos.OrganizeRequest req
    ) {
        return ApiResponse.ok(surveyService.organize(ownerId(), id, req));
    }

    /** Persist the manual drag order of surveys in one folder/root (issue #94). */
    @PUT
    @Path("/reorder")
    public ApiResponse<Void> reorder(org.acme.dto.SurveyDtos.ReorderRequest req) {
        surveyService.reorder(ownerId(), req);
        return ApiResponse.ok(null);
    }

    @DELETE
    @Path("/{id}")
    public ApiResponse<Void> delete(@PathParam("id") String id) {
        apiKeyGuard.checkDelete(ownerId(), id);
        surveyService.delete(ownerId(), id);
        return ApiResponse.ok(null);
    }
}
