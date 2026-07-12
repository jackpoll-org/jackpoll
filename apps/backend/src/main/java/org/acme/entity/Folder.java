package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** A folder to group surveys, owner-scoped (issue #33). */
@Entity
@Table(name = "folders")
public class Folder extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "owner_id", nullable = false, length = 36)
    public String ownerId;

    @Column(nullable = false, length = 120)
    public String name;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
