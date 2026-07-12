package org.acme.resource;

import org.acme.dto.ApiResponse;
import org.acme.dto.AuthDtos;
import org.acme.exception.RateLimitedException;
import org.acme.service.AuthService;
import org.acme.service.RateLimiterService;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.security.Authenticated;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.CookieParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.NewCookie;
import jakarta.ws.rs.core.Response;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {

    /** httpOnly cookie holding the Keycloak refresh token (never readable by JS). */
    private static final String REFRESH_COOKIE = "refresh_token";

    @Inject
    AuthService authService;

    @Inject
    SecurityIdentity identity;

    @Inject
    RateLimiterService rateLimiter;

    @ConfigProperty(name = "survey.auth.cookie-secure", defaultValue = "true")
    boolean cookieSecure;

    @ConfigProperty(name = "survey.auth.rate-limit.max", defaultValue = "10")
    int authRateLimitMax;

    @ConfigProperty(name = "survey.auth.rate-limit.window-seconds", defaultValue = "300")
    long authRateLimitWindowSeconds;

    /**
     * Brute-force guard (#56) for the public auth endpoints. Limits per client
     * IP and, when given, per account so neither a single source nor a single
     * target can be hammered. Throws 429 when the window is exhausted.
     */
    private void enforceAuthRateLimit(String endpoint, String forwardedFor,
        io.vertx.core.http.HttpServerRequest http, String account) {
        String ip = clientIp(forwardedFor, http);
        boolean ipOk = rateLimiter.allow(
            "auth|" + endpoint + "|ip|" + (ip == null ? "unknown" : ip),
            authRateLimitMax, authRateLimitWindowSeconds);
        boolean acctOk = account == null || account.isBlank() || rateLimiter.allow(
            "auth|" + endpoint + "|acct|" + account.trim().toLowerCase(),
            authRateLimitMax, authRateLimitWindowSeconds);
        if (!ipOk || !acctOk) {
            throw new RateLimitedException(
                "Too many attempts. Please wait a moment and try again.");
        }
    }

    /**
     * Real client IP for brute-force rate limiting. The reverse proxy (Traefik)
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

    @ConfigProperty(name = "keycloak.url", defaultValue = "http://localhost:8180")
    String keycloakUrl;

    @ConfigProperty(name = "keycloak.realm", defaultValue = "survey-school")
    String keycloakRealm;

    @ConfigProperty(name = "keycloak.client-id", defaultValue = "survey-backend")
    String keycloakClientId;

    @POST
    @Path("/register")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response register(
        @Valid AuthDtos.RegisterRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        enforceAuthRateLimit("register", forwardedFor, http, req.email());
        var result = authService.register(req);
        if (!result.success()) {
            return Response.status(Response.Status.CONFLICT).entity(result).build();
        }
        // No auto-login: the account is unverified and must confirm the emailed
        // code before it can sign in (#security email-verify).
        return Response.ok(result).build();
    }

    @POST
    @Path("/login")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response login(
        @Valid AuthDtos.LoginRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @HeaderParam("X-Auth-Offline") String offlineHeader,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        // Native clients send X-Auth-Offline: true to get a long-lived offline
        // refresh token (returned in the body) for biometric persistent login.
        boolean offline = "true".equalsIgnoreCase(offlineHeader);
        enforceAuthRateLimit("login", forwardedFor, http, req.email());
        var result = authService.login(req, offline);
        if (!result.success()) {
            // Valid credentials but unverified email → 403 (a fresh code was sent),
            // so the client can route to the verification screen instead of showing
            // an "invalid password" error. Everything else is 401.
            var status = org.acme.service.KeycloakService.EMAIL_NOT_VERIFIED.equals(result.error())
                ? Response.Status.FORBIDDEN
                : Response.Status.UNAUTHORIZED;
            return Response.status(status).entity(result).build();
        }
        return okWithRefreshCookie(result, offline);
    }

    /**
     * Silent re-auth (issue #35): exchanges the httpOnly refresh cookie for a
     * fresh access token (and rotates the refresh cookie). Returns 401 with a
     * cleared cookie when the refresh token is invalid/expired.
     */
    @POST
    @Path("/refresh")
    @PermitAll
    public Response refresh(
        @CookieParam(REFRESH_COOKIE) String refreshToken,
        @HeaderParam("X-Refresh-Token") String headerToken
    ) {
        // Native apps hold the offline token in secure storage (no cookie), so
        // accept it via header. When used, return the rotated offline token in
        // the body so the app can update secure storage.
        boolean nativeOffline = (refreshToken == null || refreshToken.isBlank()) && headerToken != null;
        var token = nativeOffline ? headerToken : refreshToken;
        var result = authService.refresh(token);
        if (!result.success()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                .entity(result)
                .cookie(clearRefreshCookie())
                .build();
        }
        return okWithRefreshCookie(result, nativeOffline);
    }

    @POST
    @Path("/logout")
    @PermitAll
    public Response logout(
        @CookieParam(REFRESH_COOKIE) String refreshToken,
        @HeaderParam("X-Refresh-Token") String headerToken
    ) {
        // Best-effort revocation at Keycloak (cookie token or native offline
        // token), then drop the cookie.
        var token = (refreshToken == null || refreshToken.isBlank()) ? headerToken : refreshToken;
        authService.logout(token);
        return Response.ok(ApiResponse.ok(null)).cookie(clearRefreshCookie()).build();
    }

    @POST
    @Path("/logout-all")
    @Authenticated
    public Response logoutAllDevices() {
        // Revoke every active session for the authenticated user at Keycloak —
        // invalidates all refresh/offline tokens on every device (#76), then
        // drops this device's cookie too.
        var userId = identity.getPrincipal().getName();
        authService.logoutAllDevices(userId);
        return Response.ok(ApiResponse.ok(null)).cookie(clearRefreshCookie()).build();
    }

    // ── Refresh cookie helpers (issue #35) ────────────────────────

    private Response okWithRefreshCookie(ApiResponse<AuthDtos.AuthResponseData> result) {
        return okWithRefreshCookie(result, false);
    }

    private Response okWithRefreshCookie(
            ApiResponse<AuthDtos.AuthResponseData> result, boolean attachOfflineToken) {
        var data = result.data();
        var tokens = data.tokens();
        // For native/offline clients, surface the refresh (offline) token in the
        // JSON body so it can be stored in the device keychain. The web build
        // never sets this flag and only ever gets the httpOnly cookie.
        if (attachOfflineToken && tokens.refreshToken() != null) {
            result = ApiResponse.ok(new AuthDtos.AuthResponseData(
                data.user(), tokens, tokens.refreshToken()));
        }
        if (tokens.refreshToken() == null) {
            return Response.ok(result).build();
        }
        long maxAge = tokens.refreshExpiresIn() > 0 ? tokens.refreshExpiresIn() : 1800;
        return Response.ok(result).cookie(buildRefreshCookie(tokens.refreshToken(), maxAge)).build();
    }

    private NewCookie buildRefreshCookie(String value, long maxAgeSeconds) {
        return new NewCookie.Builder(REFRESH_COOKIE)
            .value(value)
            .path("/")
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(NewCookie.SameSite.LAX)
            .maxAge((int) maxAgeSeconds)
            .build();
    }

    private NewCookie clearRefreshCookie() {
        return new NewCookie.Builder(REFRESH_COOKIE)
            .value("")
            .path("/")
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(NewCookie.SameSite.LAX)
            .maxAge(0)
            .build();
    }

    @GET
    @Path("/me")
    @Authenticated
    public Response getCurrentUser() {
        // Extract user ID from the OIDC token (sub claim)
        var userId = identity.getPrincipal().getName();
        var result = authService.getCurrentUser(userId);
        if (!result.success()) {
            return Response.status(Response.Status.NOT_FOUND).entity(result).build();
        }
        return Response.ok(
            new ApiResponse<>(true, new AuthDtos.CurrentUserWrapper(result.data()), null, null)
        ).build();
    }

    @PUT
    @Path("/profile")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updateProfile(@Valid AuthDtos.UpdateProfileRequest req) {
        var result = authService.updateProfile(identity.getPrincipal().getName(), req);
        if (!result.success()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
        }
        return Response.ok(
            new ApiResponse<>(true, new AuthDtos.CurrentUserWrapper(result.data()), null, null)
        ).build();
    }

    @POST
    @Path("/change-password")
    @Authenticated
    @Consumes(MediaType.APPLICATION_JSON)
    public Response changePassword(@Valid AuthDtos.ChangePasswordRequest req) {
        var result = authService.changePassword(identity.getPrincipal().getName(), req);
        if (!result.success()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
        }
        return Response.ok(result).build();
    }

    @POST
    @Path("/forgot-password")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response forgotPassword(
        @Valid AuthDtos.ForgotPasswordRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        enforceAuthRateLimit("forgot-password", forwardedFor, http, req.email());
        var result = authService.forgotPassword(req);
        // Always return 200 to prevent email enumeration
        return Response.ok(result).build();
    }

    /**
     * Confirm the emailed 6-digit code and mark the account verified
     * (#security email-verify). On success the client redirects to sign-in.
     */
    @POST
    @Path("/verify-email")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response verifyEmail(
        @Valid AuthDtos.VerifyEmailRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        enforceAuthRateLimit("verify-email", forwardedFor, http, req.email());
        var result = authService.verifyEmail(req);
        if (!result.success()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
        }
        return Response.ok(result).build();
    }

    /** Re-send a verification code. Always 200 (no account enumeration). */
    @POST
    @Path("/resend-verification")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response resendVerification(
        @Valid AuthDtos.ResendVerificationRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        enforceAuthRateLimit("resend-verification", forwardedFor, http, req.email());
        var result = authService.resendVerification(req.email());
        return Response.ok(result).build();
    }

    /**
     * Complete a password reset with the emailed code (replaces the old Keycloak
     * link flow). Invalid/expired code → 400; success → 200 and the client
     * redirects to sign-in.
     */
    @POST
    @Path("/reset-password")
    @PermitAll
    @Consumes(MediaType.APPLICATION_JSON)
    public Response resetPassword(
        @Valid AuthDtos.ResetPasswordRequest req,
        @HeaderParam("X-Forwarded-For") String forwardedFor,
        @Context io.vertx.core.http.HttpServerRequest http
    ) {
        enforceAuthRateLimit("reset-password", forwardedFor, http, req.email());
        var result = authService.resetPassword(req);
        if (!result.success()) {
            return Response.status(Response.Status.BAD_REQUEST).entity(result).build();
        }
        return Response.ok(result).build();
    }

    /**
     * Returns Keycloak OIDC endpoints for the frontend to use
     * (e.g., for redirect-based login, logout, etc.).
     */
    @GET
    @Path("/oidc-config")
    @PermitAll
    public Response getOidcConfig() {
        var config = new AuthDtos.OidcConfig(keycloakUrl, keycloakRealm, keycloakClientId);
        return Response.ok(ApiResponse.ok(config)).build();
    }
}
