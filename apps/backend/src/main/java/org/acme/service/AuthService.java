package org.acme.service;

import java.time.Instant;
import java.util.function.Consumer;

import org.acme.dto.ApiResponse;
import org.acme.dto.AuthDtos;
import org.acme.entity.EmailCode;
import org.acme.entity.User;
import org.acme.mail.MailCopy;
import org.acme.repository.UserRepository;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

/**
 * Auth service that delegates user management to Keycloak
 * and syncs user data into the local database.
 */
@ApplicationScoped
public class AuthService {

    private final UserRepository userRepository;
    private final KeycloakService keycloakService;
    private final EmailCodeService emailCodeService;
    private final GdprService gdprService;

    /**
     * Whether new accounts must confirm their email before they can sign in.
     * Default true (secure). Self-hosters WITHOUT a mail provider can set
     * EMAIL_VERIFICATION_REQUIRED=false so registration works without email.
     */
    @ConfigProperty(name = "app.email-verification-required", defaultValue = "true")
    boolean emailVerificationRequired;

    public AuthService(UserRepository userRepository, KeycloakService keycloakService,
                       EmailCodeService emailCodeService, GdprService gdprService) {
        this.userRepository = userRepository;
        this.keycloakService = keycloakService;
        this.emailCodeService = emailCodeService;
        this.gdprService = gdprService;
    }

    // ── Register (#security email-verify) ─────────────────────────

    /**
     * Create an unverified account and email a verification code. No tokens are
     * issued — the user must confirm the code, then sign in.
     */
    @Transactional
    public ApiResponse<AuthDtos.RegisterResult> register(
        AuthDtos.RegisterRequest req, String acceptLanguage) {
        var result = keycloakService.register(req);
        if (!result.success()) {
            return ApiResponse.error(result.error());
        }
        syncLocalUser(result.data(), acceptLanguage); // emailVerified = false
        String email = result.data().email();

        // Verification disabled (self-host without a mail provider): activate the
        // account immediately so the user can sign in without confirming a code.
        if (!emailVerificationRequired) {
            keycloakService.setEmailVerified(email);
            userRepository.findByEmail(email.trim().toLowerCase()).ifPresent(u -> {
                u.emailVerified = true;
                u.updatedAt = Instant.now();
            });
            return ApiResponse.ok(new AuthDtos.RegisterResult(email, false));
        }

        emailCodeService.issue(email, EmailCode.PURPOSE_VERIFY);
        return ApiResponse.ok(new AuthDtos.RegisterResult(email, true));
    }

    // ── Login ──────────────────────────────────────────────────────

    @Transactional
    public ApiResponse<AuthDtos.AuthResponseData> login(
        AuthDtos.LoginRequest req, boolean offline, String acceptLanguage) {
        var result = keycloakService.login(req, offline);
        if (result.success()) {
            // Refresh the mail language on every sign-in: a user who switches
            // their browser (or moves country) should not keep getting mail in
            // the language they happened to register in.
            syncLocalUser(result.data().user(), acceptLanguage);
            return result;
        }
        // Valid credentials but unverified: send a fresh code so the user can
        // finish verifying without a separate resend step.
        if (KeycloakService.EMAIL_NOT_VERIFIED.equals(result.error())) {
            emailCodeService.issue(req.email(), EmailCode.PURPOSE_VERIFY);
        }
        return result;
    }

    // ── Email verification ────────────────────────────────────────

    /** Confirm the emailed code, then flip the address to verified in Keycloak
     *  and the local user. */
    @Transactional
    public ApiResponse<Void> verifyEmail(AuthDtos.VerifyEmailRequest req) {
        if (!emailCodeService.verify(req.email(), EmailCode.PURPOSE_VERIFY, req.code())) {
            return ApiResponse.error("Invalid or expired code. Please try again.");
        }
        keycloakService.setEmailVerified(req.email());
        userRepository.findByEmail(req.email().trim().toLowerCase()).ifPresent(u -> {
            u.emailVerified = true;
            u.updatedAt = Instant.now();
        });
        return ApiResponse.ok(null);
    }

    /** Re-send a verification code. Always reports success (no account
     *  enumeration); only actually sends for a known, still-unverified user. */
    public ApiResponse<Void> resendVerification(String email) {
        userRepository.findByEmail(email.trim().toLowerCase())
            .filter(u -> !u.emailVerified)
            .ifPresent(u -> emailCodeService.issue(email, EmailCode.PURPOSE_VERIFY));
        return ApiResponse.ok(null);
    }

    // ── Refresh / Logout (issue #35) ──────────────────────────────

    @Transactional
    public ApiResponse<AuthDtos.AuthResponseData> refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ApiResponse.error("Your session has expired. Please sign in again.");
        }
        var data = keycloakService.refresh(refreshToken);
        if (data == null) {
            return ApiResponse.error("Your session has expired. Please sign in again.");
        }
        syncLocalUser(data.user());
        return ApiResponse.ok(data);
    }

    public void logout(String refreshToken) {
        keycloakService.logout(refreshToken);
    }

    /** Log the user out of every device by revoking all Keycloak sessions (#76). */
    public void logoutAllDevices(String userId) {
        keycloakService.logoutAllDevices(userId);
    }

    // ── Current User ──────────────────────────────────────────────

    public ApiResponse<AuthDtos.UserResponse> getCurrentUser(String userId) {
        var user = userRepository.findByIdOptional(userId).orElse(null);
        if (user == null) {
            return ApiResponse.error("User not found");
        }
        return ApiResponse.ok(toUserResponse(user));
    }

    // ── Profile management ────────────────────────────────────────

    @Transactional
    public ApiResponse<AuthDtos.UserResponse> updateProfile(
        String userId, AuthDtos.UpdateProfileRequest req) {
        var user = userRepository.findByIdOptional(userId).orElse(null);
        if (user == null) {
            return ApiResponse.error("User not found");
        }
        keycloakService.updateProfile(userId, req.name());
        user.name = req.name().trim();
        user.updatedAt = java.time.Instant.now();
        return ApiResponse.ok(toUserResponse(user));
    }

    public ApiResponse<Void> changePassword(
        String userId, AuthDtos.ChangePasswordRequest req) {
        var user = userRepository.findByIdOptional(userId).orElse(null);
        if (user == null) {
            return ApiResponse.error("User not found");
        }
        return keycloakService.changePassword(
            user.email, req.currentPassword(), req.newPassword(), userId);
    }

    // ── Forgot / Reset Password (code flow) ───────────────────────

    /** Email a password-reset code. Always reports success (no enumeration);
     *  only sends for a known account. */
    @Transactional
    public ApiResponse<Void> forgotPassword(AuthDtos.ForgotPasswordRequest req) {
        userRepository.findByEmail(req.email().trim().toLowerCase())
            .ifPresent(u -> emailCodeService.issue(req.email(), EmailCode.PURPOSE_RESET));
        return ApiResponse.ok(null);
    }

    /** Verify the reset code, then set the new password via the Keycloak admin
     *  API. A successful reset also implies the address is reachable, so the
     *  account is marked verified. */
    @Transactional
    public ApiResponse<Void> resetPassword(AuthDtos.ResetPasswordRequest req) {
        if (!emailCodeService.verify(req.email(), EmailCode.PURPOSE_RESET, req.code())) {
            return ApiResponse.error("Invalid or expired code. Please try again.");
        }
        var result = keycloakService.resetPasswordByEmail(req.email(), req.newPassword());
        if (!result.success()) {
            return result;
        }
        // Reaching the inbox proves the address; ensure the account is verified.
        keycloakService.setEmailVerified(req.email());
        userRepository.findByEmail(req.email().trim().toLowerCase()).ifPresent(u -> {
            u.emailVerified = true;
            u.updatedAt = Instant.now();
        });
        return ApiResponse.ok(null);
    }

    // ── Public account/data deletion (no login required) ───────────

    /** Request a deletion code: verifies the password and, on success, emails a
     *  6-digit confirmation code for {@code purpose}. Combined "invalid email or
     *  password" error on any failure — mirrors {@link #login}'s error shape, so
     *  this introduces no new account-enumeration surface. */
    private ApiResponse<Void> requestDeletion(String email, String password, String purpose) {
        String normalized = email.trim().toLowerCase();
        if (userRepository.findByEmail(normalized).isEmpty()
                || !keycloakService.verifyPassword(normalized, password)) {
            return ApiResponse.error("Invalid email or password");
        }
        emailCodeService.issue(normalized, purpose);
        return ApiResponse.ok(null);
    }

    /** Verify the emailed code and, on success, look up the user and run
     *  {@code action} on them. Shared by the account- and data-deletion confirm
     *  endpoints. */
    private ApiResponse<Void> withVerifiedUser(
            String email, String code, String purpose, Consumer<User> action) {
        String normalized = email.trim().toLowerCase();
        if (!emailCodeService.verify(normalized, purpose, code)) {
            return ApiResponse.error("Invalid or expired code. Please try again.");
        }
        var user = userRepository.findByEmail(normalized);
        if (user.isEmpty()) {
            return ApiResponse.error("Account not found");
        }
        action.accept(user.get());
        return ApiResponse.ok(null);
    }

    public ApiResponse<Void> requestAccountDeletion(String email, String password) {
        return requestDeletion(email, password, EmailCode.PURPOSE_DELETE_ACCOUNT);
    }

    public ApiResponse<Void> requestDataDeletion(String email, String password) {
        return requestDeletion(email, password, EmailCode.PURPOSE_DELETE_DATA);
    }

    /** Confirm the code and permanently delete the account and all its data. */
    @Transactional
    public ApiResponse<Void> confirmAccountDeletion(String email, String code) {
        return withVerifiedUser(email, code, EmailCode.PURPOSE_DELETE_ACCOUNT,
            user -> gdprService.deleteAccount(user.id));
    }

    /** Confirm the code and erase the user's content data, keeping the account
     *  and login active. */
    @Transactional
    public ApiResponse<Void> confirmDataDeletion(String email, String code) {
        return withVerifiedUser(email, code, EmailCode.PURPOSE_DELETE_DATA,
            user -> gdprService.clearUserData(user.id));
    }

    // ── Helpers ───────────────────────────────────────────────────

    /**
     * Sync a Keycloak user into the local database.
     * Atomic insert-or-update — see UserRepository#upsert for why a plain
     * find-then-insert is unsafe with multiple backend replicas.
     */
    private void syncLocalUser(AuthDtos.UserResponse keycloakUser) {
        syncLocalUser(keycloakUser, null);
    }

    /**
     * @param acceptLanguage the browser's {@code Accept-Language}, from which the
     *     user's mail language is derived. Null (or an unsupported language)
     *     leaves the stored one untouched.
     */
    private void syncLocalUser(AuthDtos.UserResponse keycloakUser, String acceptLanguage) {
        userRepository.upsert(
            keycloakUser.id(),
            keycloakUser.email(),
            keycloakUser.name(),
            keycloakUser.emailVerified(),
            acceptLanguage == null || acceptLanguage.isBlank()
                ? null : MailCopy.normalize(acceptLanguage));
    }

    private AuthDtos.UserResponse toUserResponse(User user) {
        return new AuthDtos.UserResponse(
            user.id,
            user.email,
            user.name,
            user.emailVerified,
            user.createdAt.toString()
        );
    }
}
