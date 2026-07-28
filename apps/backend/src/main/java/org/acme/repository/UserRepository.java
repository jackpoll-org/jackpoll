package org.acme.repository;

import java.time.Instant;
import java.util.Optional;

import org.acme.entity.User;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class UserRepository implements PanacheRepositoryBase<User, String> {

    public Optional<User> findByEmail(String email) {
        return find("email", email).firstResultOptional();
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
     * are covered explicitly: first evict any stale row that owns this email
     * under a different id (case 2 — the old id is unreachable anyway, since all
     * authenticated requests key off the current token sub), then upsert on the
     * id primary key (case 1). Both run inside the caller's transaction, so the
     * pair is atomic. There are no foreign keys into {@code users}, so evicting
     * the orphaned row is safe.
     */
    public void upsert(String id, String email, String name, boolean emailVerified,
                       String locale) {
        var em = getEntityManager();
        var now = Instant.now();
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
