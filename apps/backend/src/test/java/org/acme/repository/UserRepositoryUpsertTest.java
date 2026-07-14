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

    private static String email() {
        return "upsert-" + java.util.UUID.randomUUID() + "@example.test";
    }

    @Test
    void insertsWhenAbsent() {
        var id = java.util.UUID.randomUUID().toString();
        var email = email();

        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(id, email, "Ada", true));

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
            users.upsert(id, email, "Ada", false));
        // Re-sync with the SAME id (e.g. plain re-login) must not throw and must
        // refresh the mutable fields.
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(id, email, "Ada Lovelace", true));

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
            users.upsert(oldId, email, "Ada", false));
        QuarkusTransaction.requiringNew().run(() ->
            users.upsert(newId, email, "Ada", true));

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
}
