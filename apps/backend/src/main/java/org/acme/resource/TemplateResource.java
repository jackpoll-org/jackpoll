package org.acme.resource;

import java.util.List;

import org.acme.dto.ApiResponse;
import org.acme.dto.TemplateDtos.CreateTemplateRequest;
import org.acme.dto.TemplateDtos.TemplateDto;
import org.acme.dto.TemplateDtos.UpdateTemplateRequest;
import org.acme.service.TemplateService;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/templates")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class TemplateResource {

    @Inject
    TemplateService templateService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public Response list() {
        List<TemplateDto> data = templateService.list(ownerId());
        return Response.ok(ApiResponse.ok(data)).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@Valid CreateTemplateRequest req) {
        var created = templateService.create(ownerId(), req);
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(created))
            .build();
    }

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response update(@PathParam("id") String id, @Valid UpdateTemplateRequest req) {
        return Response.ok(ApiResponse.ok(templateService.update(ownerId(), id, req))).build();
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") String id) {
        templateService.delete(ownerId(), id);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
