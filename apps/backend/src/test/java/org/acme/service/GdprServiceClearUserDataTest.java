package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.acme.entity.CollaboratorRole;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.SurveyCollaborator;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.CollaboratorRepository;
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

    @Inject
    CollaboratorRepository collaborators;

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
    void pendingInvitesToTheVerifiedAddressAreExportedAndErased() {
        var id = UUID.randomUUID().toString();
        var email = email();
        var surveyId = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            users.upsert(id, email.toUpperCase(), "Ada", true, null);
            var invite = new SurveyCollaborator();
            invite.id = UUID.randomUUID().toString();
            invite.surveyId = surveyId;
            invite.email = email;
            invite.role = CollaboratorRole.EDITOR;
            invite.status = CollaboratorStatus.PENDING;
            collaborators.persist(invite);
        });

        var exported = QuarkusTransaction.requiringNew().call(() -> gdprService.export(id));
        assertEquals(1, ((List<?>) exported.get("collaborations")).size());

        QuarkusTransaction.requiringNew().run(() -> gdprService.clearUserData(id));

        assertEquals(0L, QuarkusTransaction.requiringNew().call(() -> collaborators.count("surveyId", surveyId)));
    }

    @Test
    void clearUserDataThrowsForUnknownUser() {
        assertThrows(ResourceNotFoundException.class,
            () -> QuarkusTransaction.requiringNew().run(
                () -> gdprService.clearUserData(UUID.randomUUID().toString())));
    }
}
