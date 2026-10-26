package org.acme.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.acme.entity.User;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

/**
 * Proves {@link UserRepository#upsert} is collision-proof for the Keycloak sync
 * flow. Regression guard for the users_email_key 500 on login: register() and
 * login() derive the local id independently, so the sync must reconcile whether
 * the identity collides on the id primary key or the email unique constraint.
 */
@QuarkusTest
class UserRepositoryUpsertTest {

    @Inject
    UserRepository users;

    @Inject
    CollaboratorRepository collaborators;

    private static String email() {
        return "upsert-" + java.util.UUID.randomUUID() + "@example.test";
    }

    @Test
    void insertsWhenAbsent() {
        var id = java.util.UUID.randomUUID().toString();
        var email = email();

        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(id, email, "Ada", true, null));

        var row = QuarkusTransaction.requiringNew().call(() ->
            users.findByIdOptional(id).orElseThrow());
        assertEquals(email, row.email);
        assertEquals("Ada", row.name);
        assertTrue(row.emailVerified);
    }

    @Test
    void sameIdIsIdempotentAndUpdatesInPlace() {
        var id = java.util.UUID.randomUUID().toString();
        var email = email();

        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(id, email, "Ada", false, null));
        // Re-sync with the SAME id (e.g. plain re-login) must not throw and must
        // refresh the mutable fields.
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(id, email, "Ada Lovelace", true, null));

        long count = QuarkusTransaction.requiringNew().call(() ->
            users.count("email", email));
        assertEquals(1, count, "must not create a second row");
        var row = QuarkusTransaction.requiringNew().call(() ->
            users.findByIdOptional(id).orElseThrow());
        assertEquals("Ada Lovelace", row.name);
        assertTrue(row.emailVerified);
    }

    @Test
    void sameEmailNewIdReconcilesToNewId() {
        // Simulate the reported bug: a stale row exists under an OLD id (as
        // register() wrote it), then login() syncs the SAME email under a
        // DIFFERENT id derived from the token. This must heal, not 500.
        var email = email();
        var oldId = java.util.UUID.randomUUID().toString();
        var newId = java.util.UUID.randomUUID().toString();

        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(oldId, email, "Ada", false, null));
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(newId, email, "Ada", true, null));

        long count = QuarkusTransaction.requiringNew().call(() ->
            users.count("email", email));
        assertEquals(1, count, "stale row under the old id must be evicted");
        assertTrue(QuarkusTransaction.requiringNew().call(() ->
            users.findByIdOptional(oldId).isEmpty()), "old id gone");
        var row = QuarkusTransaction.requiringNew().call(() ->
            users.findByIdOptional(newId).orElseThrow());
        assertEquals(email, row.email);
        assertTrue(row.emailVerified);
    }

    @Test
    void firstSignInKeepsWhatWasLinkedToTheRegisteredRow() {
        var email = email();
        var registeredId = java.util.UUID.randomUUID().toString();
        var signInId = email;
        var accepted = java.time.Instant.parse("2026-10-19T10:00:00Z");
        var surveyId = java.util.UUID.randomUUID().toString();

        QuarkusTransaction.requiringNew().run(() -> {
            users.upsert(registeredId, email, "Ada", false, "de");
            var user = users.findById(registeredId);
            user.termsAcceptedAt = accepted;
            user.termsVersion = "2026-10-19";
            var invite = new org.acme.entity.SurveyCollaborator();
            invite.id = java.util.UUID.randomUUID().toString();
            invite.surveyId = surveyId;
            invite.userId = registeredId;
            invite.role = org.acme.entity.CollaboratorRole.EDITOR;
            invite.status = org.acme.entity.CollaboratorStatus.PENDING;
            collaborators.persist(invite);
        });
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(signInId, email, "Ada", true, null));

        var row = QuarkusTransaction.requiringNew().call(() -> users.findByIdOptional(signInId).orElseThrow());
        assertEquals(accepted, row.termsAcceptedAt);
        assertEquals("2026-10-19", row.termsVersion);
        assertEquals("de", row.locale);
        assertTrue(row.emailVerified);
        assertTrue(QuarkusTransaction.requiringNew().call(() ->
            collaborators.findBySurveyAndUser(surveyId, signInId).isPresent()), "invitation follows the user");
        assertEquals(1L, (long) QuarkusTransaction.requiringNew().call(() -> users.count("email", email)));
    }
}
