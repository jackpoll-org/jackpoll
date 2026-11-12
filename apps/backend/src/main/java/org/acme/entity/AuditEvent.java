package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A security-relevant change: who did what to which record, and when. */
@Entity
@Table(name = "audit_events")
public class AuditEvent extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "actor_id", length = 36)
    public String actorId;

    @Column(nullable = false, length = 64)
    public String action;

    @Column(length = 255)
    public String target;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
