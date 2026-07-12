package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.service.SurveyService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
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
import jakarta.ws.rs.core.Response;

@Path("/surveys")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SurveyResource {

    @Inject
    SurveyService surveyService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list(
        @QueryParam("page") @DefaultValue("0") int page,
        @QueryParam("limit") @DefaultValue("20") int limit
    ) {
        var owner = ownerId();
        var data = surveyService.list(owner, page, limit);
        var meta = new ApiResponse.Meta(surveyService.count(owner), page, limit);
        return Response.ok(ApiResponse.ok(data, meta)).build();
    }

    @GET
    @Path("/{id}")
    public Response get(@PathParam("id") String id) {
        return Response.ok(ApiResponse.ok(surveyService.get(ownerId(), id))).build();
    }

    @POST
    public Response create(@Valid CreateSurveyRequest req) {
        var created = surveyService.create(ownerId(), req);
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(created))
            .build();
    }

    @PUT
    @Path("/{id}")
    public Response update(@PathParam("id") String id, @Valid UpdateSurveyRequest req) {
        return Response.ok(ApiResponse.ok(surveyService.update(ownerId(), id, req))).build();
    }

    /** Lightweight tags/folder update from the dashboard (issue #33). */
    @PUT
    @Path("/{id}/organize")
    public Response organize(
        @PathParam("id") String id,
        org.acme.dto.SurveyDtos.OrganizeRequest req
    ) {
        return Response.ok(ApiResponse.ok(surveyService.organize(ownerId(), id, req))).build();
    }

    /** Persist the manual drag order of surveys in one folder/root (issue #94). */
    @PUT
    @Path("/reorder")
    public Response reorder(org.acme.dto.SurveyDtos.ReorderRequest req) {
        surveyService.reorder(ownerId(), req);
        return Response.ok(ApiResponse.ok(null)).build();
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") String id) {
        surveyService.delete(ownerId(), id);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
