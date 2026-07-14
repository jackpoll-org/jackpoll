package org.acme.service;

import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import java.time.Instant;
import java.util.Map;

import org.acme.restclient.KeycloakAdminClient;
import org.acme.restclient.KeycloakTokenClient;
import org.acme.dto.AuthDtos;
import org.acme.dto.ApiResponse;

/**
 * Service for interacting with Keycloak via its Admin REST API and token endpoint.
 * Handles user registration, login (token exchange), password reset, and email verification.
 */
@ApplicationScoped
public class KeycloakService {

    @ConfigProperty(name = "keycloak.url")
    String keycloakUrl;

    @ConfigProperty(name = "keycloak.realm")
    String realm;

    @ConfigProperty(name = "keycloak.admin.username")
    String adminUsername;

    @ConfigProperty(name = "keycloak.admin.password")
    String adminPassword;

    @ConfigProperty(name = "keycloak.client-id")
    String clientId;

    @ConfigProperty(name = "keycloak.client-secret")
    String clientSecret;

    @RestClient
    KeycloakTokenClient tokenClient;

    @RestClient
    KeycloakAdminClient adminClient;

    /**
     * Obtain an admin access token using the client_credentials grant.
     * Uses the survey-backend service account in the application realm.
     * (Keycloak 26+ disables direct access grants on admin-cli by default.)
     */
    public String getAdminToken() {
        var response = tokenClient.clientCredentials(
            realm,
            "client_credentials",
            clientId,
            clientSecret
        );
        return response.get("access_token");
    }

    /**
     * Create a new, UNVERIFIED user in Keycloak (no tokens issued). The account
     * cannot sign in until the emailed code is confirmed (#security email-verify),
     * so registration returns only the created user — the caller sends the code
     * and blocks login until {@code emailVerified} flips.
     */
    public ApiResponse<AuthDtos.UserResponse> register(AuthDtos.RegisterRequest req) {
        String adminToken = getAdminToken();

        var email = req.email().trim().toLowerCase();
        // Create user in Keycloak
        var nameParts = req.name().trim().split("\\s+", 2);
        var firstName = nameParts[0];
        // Keycloak requires a non-null lastName; use "-" as placeholder when only one name part
        var lastName = nameParts.length > 1 ? nameParts[1] : "-";
        var userRep = new java.util.LinkedHashMap<String, Object>();
        userRep.put("username", email);
        userRep.put("email", email);
        userRep.put("firstName", firstName);
        userRep.put("lastName", lastName);
        userRep.put("enabled", true);
        // Unverified until the code is confirmed; login is blocked meanwhile.
        userRep.put("emailVerified", false);
        userRep.put("credentials", java.util.List.of(Map.of(
            "type", "password",
            "value", req.password(),
            "temporary", false
        )));

        String keycloakUserId;
        try (var createResponse = adminClient.createUser("Bearer " + adminToken, realm, userRep)) {
            if (createResponse.getStatus() != 201) {
                if (createResponse.getStatus() == 409) {
                    return ApiResponse.error("A user with this email already exists");
                }
                return ApiResponse.error("Failed to create user: " + createResponse.getStatus());
            }

            // Extract user ID from Location header
            var location = createResponse.getHeaderString("Location");
            keycloakUserId = location.substring(location.lastIndexOf('/') + 1);
        } catch (Exception e) {
            // REST Client may throw on non-2xx; check for conflict
            if (e.getMessage() != null && e.getMessage().contains("409")) {
                return ApiResponse.error("A user with this email already exists");
            }
            return ApiResponse.error("Failed to create user: " + e.getMessage());
        }

        // Assign "user" role
        assignRealmRole(adminToken, keycloakUserId, "user");

        // The Location UUID equals the token 'sub', so the local user id stays
        // consistent with what login later derives. Unverified at creation.
        return ApiResponse.ok(new AuthDtos.UserResponse(
            keycloakUserId, email, req.name().trim(), false, Instant.now().toString()));
    }

    /** Flip a user's email to verified in Keycloak (admin API), so the next
     *  login's {@code email_verified} claim is true and login is unblocked. */
    public void setEmailVerified(String email) {
        String adminToken = getAdminToken();
        var rep = new java.util.LinkedHashMap<String, Object>();
        rep.put("emailVerified", true);
        adminClient.updateUser("Bearer " + adminToken, realm, keycloakUuid(adminToken, email), rep);
    }

    /** Set a new password for a user by email (admin API) — used by the code-based
     *  password reset. No current-password check (the emailed code is the proof). */
    public ApiResponse<Void> resetPasswordByEmail(String email, String newPassword) {
        try {
            String adminToken = getAdminToken();
            String kcId = keycloakUuid(adminToken, email.trim().toLowerCase());
            adminClient.resetPassword("Bearer " + adminToken, realm, kcId,
                Map.of("type", "password", "value", newPassword, "temporary", false));
            return ApiResponse.ok(null);
        } catch (Exception e) {
            return ApiResponse.error("Could not reset the password. Please try again.");
        }
    }

    /**
     * Exchange credentials for OIDC tokens via Keycloak.
     *
     * @param offline when true, request the {@code offline_access} scope so the
     *     returned refresh token is a long-lived offline token (native apps use
     *     it for biometric persistent login). Web logins pass false.
     */
    public ApiResponse<AuthDtos.AuthResponseData> login(AuthDtos.LoginRequest req, boolean offline) {
        AuthDtos.AuthResponseData data;
        try {
            var email = req.email().trim().toLowerCase();
            // Always request "openid" explicitly — the client's defaultClientScopes
            // (web-origins/profile/roles/email) don't include it, so a bare password
            // grant omits the 'sub' claim and buildAuthResponse falls back to a
            // fabricated user id that doesn't match the one register() stored,
            // causing a spurious users_email_key conflict on first login after signup.
            var tokenResponse = tokenClient.tokenWithScope(
                realm, "password", clientId, clientSecret, email, req.password(),
                offline ? "openid offline_access" : "openid");

            data = buildAuthResponse(tokenResponse, req.email(), "");
        } catch (Exception e) {
            return ApiResponse.error("Invalid email or password");
        }
        // Block sign-in until the address is verified (#security email-verify).
        // Credentials were valid, so surface a distinct marker the caller maps to
        // 403 + a fresh code — never leak tokens for an unverified account.
        if (!data.user().emailVerified()) {
            return ApiResponse.error(EMAIL_NOT_VERIFIED);
        }
        return ApiResponse.ok(data);
    }

    /** Error marker returned by {@link #login} when credentials are valid but the
     *  account email is not yet verified. The resource maps it to HTTP 403. */
    public static final String EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

    /**
     * Resolve the Keycloak user UUID for the admin API. Our app's user id is the
     * email/username (the token's sub is absent, so we key on preferred_username),
     * but the Keycloak admin endpoints require the internal UUID — passing the
     * email there 404s and surfaced as a 500 (e.g. change password). Falls back
     * to the given id when it already looks like a UUID / no email match.
     */
    private String keycloakUuid(String adminToken, String idOrEmail) {
        if (idOrEmail == null || !idOrEmail.contains("@")) return idOrEmail;
        var email = idOrEmail.trim().toLowerCase();
        var users = adminClient.searchUsers("Bearer " + adminToken, realm, email);
        return users.stream()
            .filter(u -> email.equalsIgnoreCase((String) u.get("email"))
                || email.equalsIgnoreCase((String) u.get("username")))
            .map(u -> (String) u.get("id"))
            .findFirst()
            .orElse(idOrEmail);
    }

    /** Update a user's display name (firstName/lastName) in Keycloak. */
    public void updateProfile(String userId, String name) {
        String adminToken = getAdminToken();
        var parts = name.trim().split("\\s+", 2);
        var rep = new java.util.LinkedHashMap<String, Object>();
        rep.put("firstName", parts[0]);
        rep.put("lastName", parts.length > 1 ? parts[1] : "-");
        adminClient.updateUser("Bearer " + adminToken, realm, keycloakUuid(adminToken, userId), rep);
    }

    /**
     * Change a user's password after verifying the current one (by attempting a
     * token grant). Returns an error if the current password is wrong.
     */
    public ApiResponse<Void> changePassword(
        String email, String currentPassword, String newPassword, String userId) {
        try {
            tokenClient.token(realm, "password", clientId, clientSecret,
                email.trim().toLowerCase(), currentPassword);
        } catch (Exception e) {
            return ApiResponse.error("Current password is incorrect");
        }
        try {
            String adminToken = getAdminToken();
            String kcId = keycloakUuid(adminToken, email);
            adminClient.resetPassword("Bearer " + adminToken, realm, kcId,
                Map.of("type", "password", "value", newPassword, "temporary", false));
            return ApiResponse.ok(null);
        } catch (Exception e) {
            return ApiResponse.error("Could not change the password. Please try again.");
        }
    }

    /** Permanently delete a user from Keycloak (GDPR erasure, Art. 17). */
    public void deleteUser(String userId) {
        String adminToken = getAdminToken();
        adminClient.deleteUser("Bearer " + adminToken, realm, keycloakUuid(adminToken, userId));
    }

    /**
     * Log a user out of every device — invalidates all active sessions and
     * revokes their refresh/offline tokens in Keycloak (#76).
     */
    public void logoutAllDevices(String userId) {
        String adminToken = getAdminToken();
        adminClient.logoutAllSessions("Bearer " + adminToken, realm, keycloakUuid(adminToken, userId));
    }

    /**
     * Assign a realm role to a user.
     */
    private void assignRealmRole(String adminToken, String userId, String roleName) {
        // Get the role representation
        var role = adminClient.getRealmRole("Bearer " + adminToken, realm, roleName);
        adminClient.assignRealmRoles(
            "Bearer " + adminToken, realm, userId,
            java.util.List.of(role)
        );
    }

    /**
     * Exchange a refresh token for a fresh access (and rotated refresh) token (#35).
     * @return null when the refresh token is invalid/expired.
     */
    public AuthDtos.AuthResponseData refresh(String refreshToken) {
        try {
            var tokenResponse = tokenClient.refresh(
                realm, "refresh_token", clientId, clientSecret, refreshToken);
            return buildAuthResponse(tokenResponse, null, null);
        } catch (Exception e) {
            // Invalid/expired/revoked refresh token → caller returns 401.
            return null;
        }
    }

    /** Best-effort server-side revocation of a refresh token (#35). */
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        try {
            tokenClient.logout(realm, clientId, clientSecret, refreshToken);
        } catch (Exception ignored) {
            // Logout is best-effort; the client discards its state regardless.
        }
    }

    /** Build the public auth payload (+ JSON-ignored refresh token) from a token response. */
    private AuthDtos.AuthResponseData buildAuthResponse(
            Map<String, String> tokenResponse, String fallbackEmail, String fallbackUserId) {
        var accessToken = tokenResponse.get("access_token");
        var expiresIn = Long.parseLong(tokenResponse.getOrDefault("expires_in", "300"));
        var refreshToken = tokenResponse.get("refresh_token");
        var refreshExpiresIn = Long.parseLong(tokenResponse.getOrDefault("refresh_expires_in", "0"));
        var claims = decodeTokenClaims(accessToken);

        // Keycloak may not include 'sub' without openid scope; use preferred_username as fallback
        var userId = claims.getOrDefault("sub", claims.getOrDefault("preferred_username", fallbackUserId));
        var displayName = buildDisplayName(claims);
        var userResponse = new AuthDtos.UserResponse(
            userId,
            claims.getOrDefault("email", fallbackEmail),
            displayName,
            Boolean.parseBoolean(claims.getOrDefault("email_verified", "false")),
            claims.getOrDefault("iat", Instant.now().toString())
        );

        return new AuthDtos.AuthResponseData(
            userResponse,
            new AuthDtos.AuthTokens(accessToken, expiresIn, refreshToken, refreshExpiresIn),
            // offlineToken is attached by the resource only for native/offline logins.
            null
        );
    }

    /**
     * Decode JWT token claims without verification (Keycloak already validates).
     * Parses the payload section of the JWT.
     */
    private Map<String, String> decodeTokenClaims(String token) {
        try {
            var parts = token.split("\\.");
            if (parts.length < 2) return Map.of();
            var payload = parts[1];
            // Add padding if needed
            var padding = (4 - payload.length() % 4) % 4;
            payload += "=".repeat(padding);
            var json = new String(java.util.Base64.getUrlDecoder().decode(payload));
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            @SuppressWarnings("unchecked")
            var claims = (Map<String, Object>) mapper.readValue(json, Map.class);
            // Flatten to String map
            var result = new java.util.HashMap<String, String>();
            claims.forEach((k, v) -> result.put(k, v != null ? v.toString() : ""));
            return result;
        } catch (Exception e) {
            return Map.of();
        }
    }

    /**
     * Build a display name from Keycloak token claims.
     * Handles the case where lastName is "-" (placeholder for single-word names).
     */
    private String buildDisplayName(Map<String, String> claims) {
        var givenName = claims.getOrDefault("given_name", "");
        var familyName = claims.getOrDefault("family_name", "");
        if (!givenName.isEmpty() && !familyName.isEmpty() && !"-".equals(familyName)) {
            return givenName + " " + familyName;
        }
        if (!givenName.isEmpty()) {
            return givenName;
        }
        return claims.getOrDefault("name", claims.getOrDefault("preferred_username", ""));
    }
}