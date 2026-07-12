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
 * Short alphanumeric entry code for a survey (issue #15). One per survey;
 * stored normalized (uppercase) so matching is case-insensitive.
 */
@Entity
@Table(name = "access_codes")
public class AccessCode extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, unique = true, length = 36)
    public String surveyId;

    /** Normalized (uppercase) code, unique across the repo. */
    @Column(nullable = false, unique = true, length = 16)
    public String code;

    /** When true the code is required to enter even with the shareable link. */
    @Column(name = "require_code", nullable = false)
    public boolean requireCode;

    @Column(name = "last_rotated_at", nullable = false)
    public Instant lastRotatedAt;

    @PrePersist
    void onCreate() {
        if (lastRotatedAt == null) lastRotatedAt = Instant.now();
    }

    @PreUpdate
    void onUpdate() {
        // lastRotatedAt is set explicitly on rotation.
    }
}
