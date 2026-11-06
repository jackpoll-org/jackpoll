package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
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
    private AuthService auth;
    private User user;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        keycloak = mock(KeycloakService.class);
        codes = mock(EmailCodeService.class);
        apiKeys = mock(ApiKeyService.class);
        auth = new AuthService(users, keycloak, codes, mock(GdprService.class), apiKeys);
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
    }

    @Test
    void resettingThePasswordRevokesApiKeys() {
        when(codes.verify(user.email, EmailCode.PURPOSE_RESET, "123456")).thenReturn(true);
        when(keycloak.resetPasswordByEmail(user.email, "New1pass")).thenReturn(ApiResponse.ok(null));

        auth.resetPassword(new AuthDtos.ResetPasswordRequest(user.email, "123456", "New1pass"));

        verify(apiKeys).deleteAllForUser(user.id);
    }
}
