package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import org.acme.dto.AuthDtos;
import org.acme.entity.User;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Pure unit tests for {@link AuthService#updateProfile} — no Quarkus boot or
 * database required. Covers the once-a-week display-name limit (#profile).
 */
class AuthServiceUpdateProfileTest {

    private static final String USER_ID = "user-1";

    private UserRepository userRepository;
    private KeycloakService keycloakService;
    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        keycloakService = mock(KeycloakService.class);
        authService = new AuthService(
            userRepository, keycloakService, mock(EmailCodeService.class), mock(GdprService.class));
        authService.nameChangeMinIntervalDays = 7;

        user = new User();
        user.id = USER_ID;
        user.email = "user@example.com";
        user.name = "Old Name";
        user.createdAt = Instant.now();
        user.updatedAt = Instant.now();
        when(userRepository.findByIdOptional(USER_ID)).thenReturn(Optional.of(user));
    }

    @Test
    void firstNameChangeSucceeds() {
        var result = authService.updateProfile(USER_ID, new AuthDtos.UpdateProfileRequest("New Name"));

        assertTrue(result.success());
        assertEquals("New Name", user.name);
        assertTrue(user.nameChangedAt != null);
        verify(keycloakService).updateProfile(USER_ID, "New Name");
    }

    @Test
    void secondChangeWithinAWeekIsRejected() {
        user.nameChangedAt = Instant.now().minus(2, ChronoUnit.DAYS);

        var result = authService.updateProfile(USER_ID, new AuthDtos.UpdateProfileRequest("Another Name"));

        assertTrue(!result.success());
        // Name stays unchanged and Keycloak is never called.
        assertEquals("Old Name", user.name);
        verify(keycloakService, never()).updateProfile(anyString(), anyString());
    }

    @Test
    void changeAfterAWeekSucceeds() {
        user.nameChangedAt = Instant.now().minus(8, ChronoUnit.DAYS);

        var result = authService.updateProfile(USER_ID, new AuthDtos.UpdateProfileRequest("Another Name"));

        assertTrue(result.success());
        assertEquals("Another Name", user.name);
        verify(keycloakService).updateProfile(eq(USER_ID), eq("Another Name"));
    }

    @Test
    void resubmittingTheSameNameNeverHitsTheCooldown() {
        user.nameChangedAt = Instant.now().minus(1, ChronoUnit.DAYS);

        var result = authService.updateProfile(USER_ID, new AuthDtos.UpdateProfileRequest("Old Name"));

        assertTrue(result.success());
        verify(keycloakService, never()).updateProfile(any(), any());
    }

    @Test
    void currentUserResponseExposesNextAllowedChangeDate() {
        user.nameChangedAt = Instant.now().minus(1, ChronoUnit.DAYS);

        var result = authService.getCurrentUser(USER_ID);

        assertTrue(result.success());
        assertTrue(result.data().nextNameChangeAt() != null);
    }

    @Test
    void currentUserResponseHasNoCooldownWhenNeverChanged() {
        var result = authService.getCurrentUser(USER_ID);

        assertTrue(result.success());
        assertNull(result.data().nextNameChangeAt());
    }
}
