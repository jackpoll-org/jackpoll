package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

/**
 * Unit tests for {@link GdprService#clearUserData}: the "delete my data" flow
 * must erase content but leave the {@code users} row (and thus the account)
 * intact — the difference from {@link GdprService#deleteAccount}, which also
 * removes the user and calls Keycloak.
 */
@QuarkusTest
class GdprServiceClearUserDataTest {

    @Inject
    GdprService gdprService;

    @Inject
    UserRepository users;

    private static String email() {
        return "gdpr-clear-" + UUID.randomUUID() + "@example.test";
    }

    @Test
    void clearUserDataKeepsTheAccountRow() {
        var id = UUID.randomUUID().toString();
        var email = email();
        QuarkusTransaction.requiringNew().run(() -> users.upsert(id, email, "Ada", true, null));

        QuarkusTransaction.requiringNew().run(() -> gdprService.clearUserData(id));

        assertTrue(QuarkusTransaction.requiringNew().call(() -> users.findByIdOptional(id).isPresent()),
            "the user row must survive a data-only deletion");
    }

    @Test
    void clearUserDataThrowsForUnknownUser() {
        assertThrows(ResourceNotFoundException.class,
            () -> QuarkusTransaction.requiringNew().run(
                () -> gdprService.clearUserData(UUID.randomUUID().toString())));
    }
}
