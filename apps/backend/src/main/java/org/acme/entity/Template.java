package org.acme.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** A user-saved survey template (issue #20), scoped to its owner. */
@Entity
@Table(name = "templates")
public class Template extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "owner_id", nullable = false, length = 36)
    public String ownerId;

    @Column(nullable = false, length = 255)
    public String name;

    @Column(columnDefinition = "text")
    public String description;

    /** Snapshot of the survey's questions as JSON (frontend Question[] shape). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Object questions;

    /** Snapshot of survey-level settings as JSON. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Object settings;

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
