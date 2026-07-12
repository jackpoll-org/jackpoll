package org.acme.resource;

import org.acme.dto.AccessCodeDtos.EnterCodeRequest;
import org.acme.dto.ApiResponse;
import org.acme.service.AccessCodeService;

import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Public entry by access code (issue #15). */
@Path("/public/access-code")
@Produces(MediaType.APPLICATION_JSON)
public class PublicAccessResource {

    @Inject
    AccessCodeService accessCodeService;

    @POST
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response resolve(@Valid EnterCodeRequest req) {
        return Response.ok(ApiResponse.ok(accessCodeService.resolve(req.code()))).build();
    }
}
