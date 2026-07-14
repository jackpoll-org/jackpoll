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
     * Atomic insert-or-update on the Keycloak user id (primary key). With
     * multiple backend replicas, two requests can race to sync the SAME
     * not-yet-local user concurrently; a plain find-then-insert loses that
     * race with a unique-constraint exception that rolls back the caller's
     * transaction. ON CONFLICT (id) makes the race a no-op instead of an error.
     *
     * Only "id" is the conflict target — a violation on the email column
     * instead (different Keycloak id, same email) is a genuine duplicate
     * Keycloak account and is left to fail loudly rather than silently
     * reassigning a primary key other tables reference by foreign key.
     */
    public void upsert(String id, String email, String name, boolean emailVerified) {
        var now = Instant.now();
        getEntityManager().createNativeQuery("""
                INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ON CONFLICT (id) DO UPDATE SET
                    email = excluded.email,
                    name = excluded.name,
                    email_verified = excluded.email_verified,
                    updated_at = excluded.updated_at
                """)
            .setParameter(1, id)
            .setParameter(2, email)
            .setParameter(3, name)
            .setParameter(4, emailVerified)
            .setParameter(5, now)
            .executeUpdate();
    }
}
