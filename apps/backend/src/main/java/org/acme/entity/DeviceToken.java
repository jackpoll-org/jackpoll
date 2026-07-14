package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** A registered push-notification token for one user's device (mobile app). */
@Entity
@Table(name = "device_tokens")
public class DeviceToken extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    /** Keycloak user id (sub) that owns the device. */
    @Column(name = "user_id", nullable = false, length = 36)
    public String userId;

    /** The Web Push endpoint URL — unique across devices. (Column kept as
     *  "token" for schema compatibility with the earlier FCM/APNs design.) */
    @Column(nullable = false, unique = true, length = 512)
    public String token;

    /** "web" (browser) | "android-up" (UnifiedPush) | legacy "android"/"ios". */
    @Column(length = 16)
    public String platform;

    /** The subscription's ECDH P-256 public key (base64url). */
    @Column(length = 255)
    public String p256dh;

    /** The subscription's auth secret (base64url). */
    @Column(length = 255)
    public String auth;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
