package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;  // Keycloak user ID (sub claim)

    @Column(nullable = false, unique = true, length = 255)
    public String email;

    @Column(nullable = false, length = 255)
    public String name;

    @Column(name = "email_verified", nullable = false)
    public boolean emailVerified;

    /**
     * Language for the emails we send this user ("en"/"de"), captured from the
     * browser's Accept-Language when the account is created and refreshed on
     * sign-in. Null until then — mail falls back to English.
     */
    @Column(length = 8)
    public String locale;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void onCreate() {
        var now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
