package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "api_keys")
public class ApiKey extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "user_id", nullable = false, length = 255)
    public String userId;

    @Column(nullable = false, length = 100)
    public String name;

    @Column(nullable = false, length = 16)
    public String prefix;

    @Column(name = "key_hash", nullable = false, unique = true, length = 64)
    public String keyHash;

    @Column(nullable = false, length = 100)
    public String scopes;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "last_used_at")
    public Instant lastUsedAt;
}
