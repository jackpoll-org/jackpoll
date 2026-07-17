package org.acme.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Auth-related DTOs — mirrors the frontend types in {@code survey-frontend/app/types/auth.ts}.
 */
public final class AuthDtos {

    private AuthDtos() {}

    // ── Login ─────────────────────────────────────────────────────

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    // ── Register ──────────────────────────────────────────────────

    public record RegisterRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8)
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).+$",
                 message = "Password must contain at least one uppercase letter, one lowercase letter, and one number")
        String password
    ) {}

    // ── Email verification (#security email-verify) ───────────────

    /** Register no longer auto-logs-in: the account starts unverified and the
     *  client must confirm the emailed code before it can sign in. */
    public record RegisterResult(
        String email,
        boolean verificationRequired
    ) {}

    public record VerifyEmailRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "Code must be 6 digits")
        String code
    ) {}

    public record ResendVerificationRequest(
        @NotBlank @Email String email
    ) {}

    // ── Forgot Password ───────────────────────────────────────────

    public record ForgotPasswordRequest(
        @NotBlank @Email String email
    ) {}

    /** Complete a password reset with the emailed code (replaces the old
     *  Keycloak link flow). */
    public record ResetPasswordRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "Code must be 6 digits")
        String code,
        @NotBlank @Size(min = 8)
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).+$",
                 message = "Password must contain at least one uppercase letter, one lowercase letter, and one number")
        String newPassword
    ) {}

    // ── Public account/data deletion (no login required) ───────────

    public record DeleteRequestRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record DeleteConfirmRequest(
        @NotBlank @Email String email,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "Code must be 6 digits")
        String code
    ) {}

    // ── Profile management ────────────────────────────────────────

    public record UpdateProfileRequest(
        @NotBlank @Size(max = 100) String name
    ) {}

    public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8)
        @Pattern(regexp = "^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).+$",
                 message = "Password must contain at least one uppercase letter, one lowercase letter, and one number")
        String newPassword
    ) {}

    // ── Responses ─────────────────────────────────────────────────

    public record UserResponse(
        String id,
        String email,
        String name,
        boolean emailVerified,
        String createdAt
    ) {}

    public record CurrentUserWrapper(
        UserResponse user
    ) {}

    public record AuthTokens(
        String accessToken,
        long expiresIn,
        // Refresh token is delivered to the browser as an httpOnly cookie set by
        // the resource — never serialized into the JSON body (#35).
        @JsonIgnore String refreshToken,
        @JsonIgnore long refreshExpiresIn
    ) {}

    public record AuthResponseData(
        UserResponse user,
        AuthTokens tokens,
        // Long-lived offline refresh token, serialized ONLY for native clients
        // that requested offline_access (X-Auth-Offline). The web never receives
        // it — the refresh token stays an httpOnly cookie there. Null otherwise.
        @JsonInclude(JsonInclude.Include.NON_NULL) String offlineToken
    ) {}

    // ── OIDC Config (for frontend) ────────────────────────────────

    public record OidcConfig(
        String keycloakUrl,
        String realm,
        String clientId,
        boolean emailVerificationRequired,
        boolean debugToolsEnabled
    ) {}
}
