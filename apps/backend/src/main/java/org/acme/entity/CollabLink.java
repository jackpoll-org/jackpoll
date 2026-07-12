package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * A passwordless editing link for a survey (issue #22). Anyone with the slug
 * can edit the survey until the owner-set expiry; rotating issues a new slug.
 */
@Entity
@Table(name = "collab_links")
public class CollabLink extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, unique = true, length = 36)
    public String surveyId;

    @Column(nullable = false, unique = true, length = 24)
    public String slug;

    /** Optional ISO-8601 instant after which the link stops working. */
    @Column(name = "expires_at")
    public String expiresAt;

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
