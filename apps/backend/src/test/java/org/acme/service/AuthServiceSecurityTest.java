package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.acme.dto.ApiResponse;
import org.acme.dto.AuthDtos;
import org.acme.entity.EmailCode;
import org.acme.entity.User;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AuthServiceSecurityTest {

    private UserRepository users;
    private KeycloakService keycloak;
    private EmailCodeService codes;
    private ApiKeyService apiKeys;
    private PushService push;
    private AuthService auth;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        keycloak = mock(KeycloakService.class);
        codes = mock(EmailCodeService.class);
        apiKeys = mock(ApiKeyService.class);
        push = mock(PushService.class);
        auth = new AuthService(users, keycloak, codes, mock(GdprService.class), apiKeys, mock(AuditService.class), push);
        auth.termsVersion = Optional.empty();
        auth.emailVerificationRequired = true;

        user = new User();
        user.id = "user-1";
        user.email = "taken@example.com";
        when(users.findByIdOptional(user.id)).thenReturn(Optional.of(user));
        when(users.findByEmail(user.email)).thenReturn(Optional.of(user));
    }

    @Test
    void registeringATakenEmailLooksLikeSuccessAndMailsTheOwner() {
        user.emailVerified = true;
        when(keycloak.register(any())).thenReturn(ApiResponse.error(KeycloakService.EMAIL_TAKEN));

        var result = auth.register(
            new AuthDtos.RegisterRequest("Someone", user.email, "Password1", true), null);

        assertTrue(result.success());
        assertTrue(result.data().verificationRequired());
        verify(codes).issue(user.email, EmailCode.PURPOSE_RESET);
    }

    @Test
    void registeringAgainBeforeVerifyingMailsAFreshVerificationCode() {
        when(keycloak.register(any())).thenReturn(ApiResponse.error(KeycloakService.EMAIL_TAKEN));

        auth.register(new AuthDtos.RegisterRequest("Someone", user.email, "Password1", true), null);

        verify(codes).issue(user.email, EmailCode.PURPOSE_VERIFY);
    }

    @Test
    void changingThePasswordRevokesApiKeys() {
        when(keycloak.changePassword(user.email, "Old1pass", "New1pass", user.id))
            .thenReturn(ApiResponse.ok(null));

        auth.changePassword(user.id, new AuthDtos.ChangePasswordRequest("Old1pass", "New1pass"));

        verify(apiKeys).deleteAllForUser(user.id);
        verify(push).unregisterAll(user.id);
    }

    @Test
    void aFailedPasswordChangeKeepsApiKeys() {
        when(keycloak.changePassword(user.email, "wrong", "New1pass", user.id))
            .thenReturn(ApiResponse.error("Current password is incorrect"));

        auth.changePassword(user.id, new AuthDtos.ChangePasswordRequest("wrong", "New1pass"));

        verify(apiKeys, never()).deleteAllForUser(user.id);
    }

    @Test
    void loggingOutEverywhereRevokesApiKeys() {
        auth.logoutAllDevices(user.id);

        verify(apiKeys).deleteAllForUser(user.id);
        verify(push).unregisterAll(user.id);
    }

    @Test
    void resettingThePasswordRevokesApiKeys() {
        when(codes.verify(user.email, EmailCode.PURPOSE_RESET, "123456")).thenReturn(true);
        when(keycloak.resetPasswordByEmail(user.email, "New1pass")).thenReturn(ApiResponse.ok(null));

        auth.resetPassword(new AuthDtos.ResetPasswordRequest(user.email, "123456", "New1pass"));

        verify(apiKeys).deleteAllForUser(user.id);
        verify(push).unregisterAll(user.id);
    }

    @Test
    void registeringDoesNotAdoptAStaleRowBeforeTheAddressIsProven() {
        when(keycloak.register(any())).thenReturn(ApiResponse.ok(new AuthDtos.UserResponse(
            "new-kc-id", user.email, "Someone", false, "2026-01-01T00:00:00Z", null)));

        auth.register(new AuthDtos.RegisterRequest("Someone", user.email, "Password1", true), null);

        verify(users, never()).upsert(anyString(), anyString(), anyString(), anyBoolean(), any(), anyBoolean());
        verify(users, never()).upsert(anyString(), anyString(), anyString(), anyBoolean(), any());
    }

    @Test
    void registeringWithoutVerificationNeverAdoptsAStaleRow() {
        auth.emailVerificationRequired = false;
        when(keycloak.register(any())).thenReturn(ApiResponse.ok(new AuthDtos.UserResponse(
            "new-kc-id", user.email, "Someone", false, "2026-01-01T00:00:00Z", null)));

        auth.register(new AuthDtos.RegisterRequest("Someone", user.email, "Password1", true), null);

        verify(users).upsert("new-kc-id", user.email, "Someone", false, null, false);
    }

    @Test
    void registeringNextToAStaleRowLeavesItsTermsAcceptanceAlone() {
        auth.termsVersion = Optional.of("2026-01");
        when(keycloak.register(any())).thenReturn(ApiResponse.ok(new AuthDtos.UserResponse(
            "new-kc-id", user.email, "Someone", false, "2026-01-01T00:00:00Z", null)));

        auth.register(new AuthDtos.RegisterRequest("Someone", user.email, "Password1", true), null);

        assertNull(user.termsAcceptedAt);
        assertNull(user.termsVersion);
    }

    @Test
    void registeringStampsTermsOnTheNewAccount() {
        auth.termsVersion = Optional.of("2026-01");
        var fresh = new User();
        fresh.id = "new-kc-id";
        fresh.email = "fresh@example.com";
        when(users.findByIdOptional(fresh.id)).thenReturn(Optional.of(fresh));
        when(keycloak.register(any())).thenReturn(ApiResponse.ok(new AuthDtos.UserResponse(
            fresh.id, fresh.email, "Someone", false, "2026-01-01T00:00:00Z", null)));

        auth.register(new AuthDtos.RegisterRequest("Someone", fresh.email, "Password1", true), null);

        assertEquals("2026-01", fresh.termsVersion);
    }

    @Test
    void verifyingMovesAStaleRowToTheNewAccountAndStampsItsTerms() {
        auth.registrationEnabled = true;
        auth.termsVersion = Optional.of("2026-01");
        user.name = "Old";
        var adopted = new User();
        adopted.id = "new-kc-id";
        adopted.email = user.email;
        when(codes.verify(user.email, EmailCode.PURPOSE_VERIFY, "123456")).thenReturn(true);
        when(keycloak.setEmailVerified(user.email)).thenReturn(adopted.id);
        when(users.findByIdOptional(adopted.id)).thenReturn(Optional.of(adopted));

        auth.verifyEmail(new AuthDtos.VerifyEmailRequest(user.email, "123456"));

        verify(users).upsert(adopted.id, user.email, "Old", true, null, true);
        assertTrue(adopted.emailVerified);
        assertEquals("2026-01", adopted.termsVersion);
        assertFalse(user.emailVerified);
    }

    @Test
    void verifyingTheSameAccountOnlyFlagsItVerified() {
        auth.registrationEnabled = true;
        when(codes.verify(user.email, EmailCode.PURPOSE_VERIFY, "123456")).thenReturn(true);
        when(keycloak.setEmailVerified(user.email)).thenReturn(user.id);

        auth.verifyEmail(new AuthDtos.VerifyEmailRequest(user.email, "123456"));

        verify(users, never()).upsert(anyString(), anyString(), any(), anyBoolean(), any(), anyBoolean());
        assertTrue(user.emailVerified);
    }

    @Test
    void resendingVerificationFollowsKeycloakNotAStaleVerifiedRow() {
        auth.registrationEnabled = true;
        user.emailVerified = true;
        when(keycloak.isUnverified(user.email)).thenReturn(true);

        auth.resendVerification(user.email);

        verify(codes).issue(user.email, EmailCode.PURPOSE_VERIFY);
    }

    @Test
    void resendingVerificationSkipsAVerifiedKeycloakUser() {
        auth.registrationEnabled = true;

        auth.resendVerification(user.email);

        verify(codes, never()).issue(anyString(), anyString());
    }
}
