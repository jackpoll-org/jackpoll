package org.acme.restclient;

import java.util.Map;

import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.FormParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * REST client for Keycloak token endpoint.
 */
@Path("/realms")
@RegisterRestClient(configKey = "keycloak-token-client")
@Produces(MediaType.APPLICATION_JSON)
public interface KeycloakTokenClient {

    @POST
    @Path("/{realm}/protocol/openid-connect/token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    Map<String, String> token(@PathParam("realm") String realm,
                               @FormParam("grant_type") String grantType,
                               @FormParam("client_id") String clientId,
                               @FormParam("client_secret") String clientSecret,
                               @FormParam("username") String username,
                               @FormParam("password") String password);

    /**
     * Password grant with an explicit scope — used to request {@code offline_access}
     * so native apps receive a long-lived offline refresh token for biometric
     * persistent login.
     */
    @POST
    @Path("/{realm}/protocol/openid-connect/token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    Map<String, String> tokenWithScope(@PathParam("realm") String realm,
                               @FormParam("grant_type") String grantType,
                               @FormParam("client_id") String clientId,
                               @FormParam("client_secret") String clientSecret,
                               @FormParam("username") String username,
                               @FormParam("password") String password,
                               @FormParam("scope") String scope);

    /**
     * Token request without client_secret (e.g., for admin-cli).
     */
    @POST
    @Path("/{realm}/protocol/openid-connect/token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    Map<String, String> tokenNoSecret(@PathParam("realm") String realm,
                                       @FormParam("grant_type") String grantType,
                                       @FormParam("client_id") String clientId,
                                       @FormParam("username") String username,
                                       @FormParam("password") String password);

    /**
     * Token request using client_credentials grant (service account).
     */
    @POST
    @Path("/{realm}/protocol/openid-connect/token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    Map<String, String> clientCredentials(@PathParam("realm") String realm,
                                           @FormParam("grant_type") String grantType,
                                           @FormParam("client_id") String clientId,
                                           @FormParam("client_secret") String clientSecret);

    /**
     * Exchange a refresh token for a fresh access (and rotated refresh) token (#35).
     */
    @POST
    @Path("/{realm}/protocol/openid-connect/token")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    Map<String, String> refresh(@PathParam("realm") String realm,
                                 @FormParam("grant_type") String grantType,
                                 @FormParam("client_id") String clientId,
                                 @FormParam("client_secret") String clientSecret,
                                 @FormParam("refresh_token") String refreshToken);

    /**
     * Revoke a refresh token (server-side logout) via the end-session endpoint.
     */
    @POST
    @Path("/{realm}/protocol/openid-connect/logout")
    @Consumes(MediaType.APPLICATION_FORM_URLENCODED)
    void logout(@PathParam("realm") String realm,
                @FormParam("client_id") String clientId,
                @FormParam("client_secret") String clientSecret,
                @FormParam("refresh_token") String refreshToken);
}