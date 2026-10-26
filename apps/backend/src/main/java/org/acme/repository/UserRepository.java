package org.acme.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.acme.entity.User;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UserRepository implements PanacheRepositoryBase<User, String> {

    private static final String[][] USER_ID_COLUMNS = {
        {"surveys", "owner_id"},
        {"folders", "owner_id"},
        {"templates", "owner_id"},
        {"survey_collaborators", "user_id"},
        {"notifications", "user_id"},
        {"notification_preferences", "user_id"},
        {"device_tokens", "user_id"},
    };

    public Optional<User> findByEmail(String email) {
        return find("email", email).firstResultOptional();
    }

    public String localeOf(String userId) {
        return findByIdOptional(userId).map(u -> u.locale).orElse(null);
    }

    public boolean existsByEmail(String email) {
        return count("email", email) > 0;
    }

    /**
     * Idempotently sync a Keycloak user (identified by its {@code id} = the token
     * {@code sub}) into the local table. Safe to call from every auth path
     * (register, verify, login, refresh) and from concurrent backend replicas.
     *
     * The {@code users} table has two unique keys — the {@code id} primary key
     * and the {@code email} unique constraint — and a Keycloak identity can
     * collide on either:
     *   1. Same id (a plain re-login, or two replicas racing the first sync of a
     *      brand-new user) — must be a no-op update, not a 23505 that rolls back
     *      the caller's login transaction.
     *   2. Same email under a *different* id — happens when a Keycloak account is
     *      recreated (e.g. after a data wipe or re-registration) and thus gets a
     *      new UUID while a stale local row still holds the old id. register()
     *      writes the row keyed on the Keycloak Location UUID and login() keys it
     *      on the token sub; if those ever diverge, the email constraint is what
     *      blows up (the bug behind the users_email_key 500s).
     *
     * Postgres allows only one ON CONFLICT arbiter per statement, so both cases
     * are covered explicitly. Case 2 also happens on every first sign-in, because
     * the token carries no sub and login() keys the row on the username instead:
     * the row register() wrote — with the terms acceptance and any invitation or
     * notification sent before that first sign-in — moves to the new id together
     * with everything that references it. Only when the new id is already taken
     * is the stale row evicted. Then upsert on the id primary key (case 1). All of
     * it runs inside the caller's transaction, so it is atomic. There are no
     * foreign keys into {@code users}; the references are plain id columns.
     */
    public void upsert(String id, String email, String name, boolean emailVerified,
                       String locale) {
        var em = getEntityManager();
        var now = Instant.now();
        @SuppressWarnings("unchecked")
        List<String> staleIds = em.createNativeQuery("SELECT id FROM users WHERE email = ?1 AND id <> ?2")
            .setParameter(1, email)
            .setParameter(2, id)
            .getResultList();
        boolean idFree = em.createNativeQuery("SELECT 1 FROM users WHERE id = ?1")
            .setParameter(1, id)
            .getResultList()
            .isEmpty();
        if (idFree && staleIds.size() == 1) {
            var staleId = staleIds.get(0);
            for (var column : USER_ID_COLUMNS) {
                em.createNativeQuery("UPDATE " + column[0] + " SET " + column[1] + " = ?1 WHERE " + column[1] + " = ?2")
                    .setParameter(1, id)
                    .setParameter(2, staleId)
                    .executeUpdate();
            }
            em.createNativeQuery("UPDATE users SET id = ?1 WHERE id = ?2")
                .setParameter(1, id)
                .setParameter(2, staleId)
                .executeUpdate();
        }
        // Case 2: drop a stale row that would otherwise collide on the email key.
        em.createNativeQuery("DELETE FROM users WHERE email = ?1 AND id <> ?2")
            .setParameter(1, email)
            .setParameter(2, id)
            .executeUpdate();
        // Case 1: insert, or update in place when this exact id already exists.
        // Notification preferences (#89) now live in a separate table keyed by
        // (user_id, event_type, channel) — a missing row defaults to enabled, so
        // there is nothing to seed here on insert.
        em.createNativeQuery("""
                INSERT INTO users (id, email, name, email_verified, locale,
                                   created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?6, ?5, ?5)
                ON CONFLICT (id) DO UPDATE SET
                    email = excluded.email,
                    name = excluded.name,
                    email_verified = excluded.email_verified,
                    -- Keep the stored language when this sign-in carried none,
                    -- so a client that sends no Accept-Language can't wipe it.
                    locale = COALESCE(excluded.locale, users.locale),
                    updated_at = excluded.updated_at
                """)
            .setParameter(1, id)
            .setParameter(2, email)
            .setParameter(3, name)
            .setParameter(4, emailVerified)
            .setParameter(5, now)
            .setParameter(6, locale)
            .executeUpdate();
    }
}
