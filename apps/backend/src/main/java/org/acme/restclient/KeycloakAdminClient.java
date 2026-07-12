package org.acme.restclient;

import java.util.List;
import java.util.Map;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/**
 * REST client for Keycloak Admin REST API.
 */
@Path("/admin/realms")
@RegisterRestClient(configKey = "keycloak-admin-client")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public interface KeycloakAdminClient {

    @POST
    @Path("/{realm}/users")
    Response createUser(@HeaderParam("Authorization") String authHeader,
                        @PathParam("realm") String realm,
                        Map<String, Object> userRepresentation);

    @GET
    @Path("/{realm}/users")
    List<Map<String, Object>> searchUsers(@HeaderParam("Authorization") String authHeader,
                                           @PathParam("realm") String realm,
                                           @QueryParam("email") String email);

    @GET
    @Path("/{realm}/users/{userId}")
    Map<String, Object> getUser(@HeaderParam("Authorization") String authHeader,
                                @PathParam("realm") String realm,
                                @PathParam("userId") String userId);

    @PUT
    @Path("/{realm}/users/{userId}")
    void updateUser(@HeaderParam("Authorization") String authHeader,
                    @PathParam("realm") String realm,
                    @PathParam("userId") String userId,
                    Map<String, Object> userRepresentation);

    @PUT
    @Path("/{realm}/users/{userId}/reset-password")
    void resetPassword(@HeaderParam("Authorization") String authHeader,
                       @PathParam("realm") String realm,
                       @PathParam("userId") String userId,
                       Map<String, Object> credential);

    @DELETE
    @Path("/{realm}/users/{userId}")
    void deleteUser(@HeaderParam("Authorization") String authHeader,
                    @PathParam("realm") String realm,
                    @PathParam("userId") String userId);

    /** Log the user out of all sessions — revokes their refresh/offline tokens (#76). */
    @POST
    @Path("/{realm}/users/{userId}/logout")
    void logoutAllSessions(@HeaderParam("Authorization") String authHeader,
                           @PathParam("realm") String realm,
                           @PathParam("userId") String userId);

    @PUT
    @Path("/{realm}/users/{userId}/execute-actions-email")
    void executeActionsEmail(@HeaderParam("Authorization") String authHeader,
                             @PathParam("realm") String realm,
                             @PathParam("userId") String userId,
                             @QueryParam("redirect_uri") String redirectUri,
                             List<String> actions);

    @PUT
    @Path("/{realm}/users/{userId}/send-verify-email")
    void sendVerifyEmail(@HeaderParam("Authorization") String authHeader,
                         @PathParam("realm") String realm,
                         @PathParam("userId") String userId);

    @GET
    @Path("/{realm}/roles/{roleName}")
    Map<String, Object> getRealmRole(@HeaderParam("Authorization") String authHeader,
                                      @PathParam("realm") String realm,
                                      @PathParam("roleName") String roleName);

    @POST
    @Path("/{realm}/users/{userId}/role-mappings/realm")
    void assignRealmRoles(@HeaderParam("Authorization") String authHeader,
                          @PathParam("realm") String realm,
                          @PathParam("userId") String userId,
                          List<Map<String, Object>> roles);
}