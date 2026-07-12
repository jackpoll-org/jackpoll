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

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    // ── Notification preferences (issue #89) ──────────────────────
    // Account-level channel master switches; default true preserves the
    // pre-#89 behaviour. Gated on top of the per-survey ownerNotify cadence.
    @Column(name = "notify_new_response_email", nullable = false)
    public boolean notifyNewResponseEmail = true;

    @Column(name = "notify_new_response_mobile", nullable = false)
    public boolean notifyNewResponseMobile = true;

    @Column(name = "notify_new_response_web", nullable = false)
    public boolean notifyNewResponseWeb = true;

    @Column(name = "notify_daily_digest_email", nullable = false)
    public boolean notifyDailyDigestEmail = true;

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
