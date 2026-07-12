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
 * The canonical public handle for a published survey (issue #16). One per
 * survey; rotating it issues a new slug so the old link stops resolving.
 */
@Entity
@Table(name = "share_links")
public class ShareLink extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, unique = true, length = 36)
    public String surveyId;

    /** URL-safe public slug, unique across the repo. */
    @Column(nullable = false, unique = true, length = 24)
    public String slug;

    /** Optional ISO-8601 instant after which the link stops resolving. */
    @Column(name = "expires_at")
    public String expiresAt;

    /** Optional max responses; once reached the link expires. */
    @Column(name = "max_responses")
    public Integer maxResponses;

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
