package org.acme.resource;

import java.util.List;

import org.acme.dto.ApiResponse;
import org.acme.dto.FolderDtos.FolderDto;
import org.acme.dto.FolderDtos.FolderRequest;
import org.acme.service.FolderService;

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

import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.jboss.resteasy.reactive.ResponseStatus;

@Path("/folders")
@Authenticated
@Produces(MediaType.APPLICATION_JSON)
public class FolderResource {

    @Inject
    FolderService folderService;

    @Inject
    SecurityIdentity identity;

    private String ownerId() {
        return identity.getPrincipal().getName();
    }

    @GET
    public ApiResponse<List<FolderDto>> list() {
        return ApiResponse.ok(folderService.list(ownerId()));
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @ResponseStatus(201)
    @APIResponse(responseCode = "201", description = "Created", content = @Content(schema = @Schema(ref = "ApiResponseFolderDto")))
    public ApiResponse<FolderDto> create(@Valid FolderRequest req) {
        return ApiResponse.ok(folderService.create(ownerId(), req));
    }

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public ApiResponse<FolderDto> rename(@PathParam("id") String id, @Valid FolderRequest req) {
        return ApiResponse.ok(folderService.rename(ownerId(), id, req));
    }

    @DELETE
    @Path("/{id}")
    public ApiResponse<Void> delete(@PathParam("id") String id) {
        folderService.delete(ownerId(), id);
        return ApiResponse.ok(null);
    }
}
