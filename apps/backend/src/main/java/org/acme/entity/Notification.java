package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** A persisted in-app notification record — the "in_app" channel's delivery target (#89). */
@Entity
@Table(name = "notifications")
public class Notification extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "user_id", nullable = false, length = 36)
    public String userId;

    @Column(name = "event_type", nullable = false, length = 40)
    public String eventType;

    @Column(nullable = false, length = 255)
    public String title;

    @Column
    public String body;

    @Column(length = 512)
    public String link;

    /** NULL = unread. */
    @Column(name = "read_at")
    public Instant readAt;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
