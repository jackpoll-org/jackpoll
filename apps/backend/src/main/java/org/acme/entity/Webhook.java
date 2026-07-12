package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * An owner-configured outbound webhook for a survey (issue #36). On each new
 * response, an HMAC-signed payload is POSTed to {@link #url}. Delivery is
 * best-effort with retries; the latest outcome is recorded for the owner.
 */
@Entity
@Table(name = "webhooks")
public class Webhook extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(nullable = false, length = 2048)
    public String url;

    @Column(nullable = false)
    public boolean enabled = true;

    /** HMAC signing secret the receiver uses to verify the X-Survey-Signature. */
    @Column(nullable = false, length = 64)
    public String secret;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    // ── Last delivery outcome (visible to the owner) ──────────────
    @Column(name = "last_status")
    public Integer lastStatus;

    @Column(name = "last_error", length = 500)
    public String lastError;

    @Column(name = "last_delivery_at")
    public Instant lastDeliveryAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
