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
import jakarta.ws.rs.core.Response;

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
    public Response list() {
        List<FolderDto> data = folderService.list(ownerId());
        return Response.ok(ApiResponse.ok(data)).build();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response create(@Valid FolderRequest req) {
        return Response.status(Response.Status.CREATED)
            .entity(ApiResponse.ok(folderService.create(ownerId(), req)))
            .build();
    }

    @PUT
    @Path("/{id}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response rename(@PathParam("id") String id, @Valid FolderRequest req) {
        return Response.ok(ApiResponse.ok(folderService.rename(ownerId(), id, req))).build();
    }

    @DELETE
    @Path("/{id}")
    public Response delete(@PathParam("id") String id) {
        folderService.delete(ownerId(), id);
        return Response.ok(ApiResponse.ok(null)).build();
    }
}
