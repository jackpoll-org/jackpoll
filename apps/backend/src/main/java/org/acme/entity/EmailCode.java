package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A transient, single-use email code for verifying an address or resetting a
 * password (#security email-verify). Only the HMAC hash of the 6-digit code is
 * stored — never the plaintext. One active row per {@code (email, purpose)}:
 * issuing a new code clears earlier rows for that pair. The durable "verified"
 * state lives in Keycloak; this row is only the delivery/redemption channel.
 */
@Entity
@Table(name = "email_code")
public class EmailCode extends PanacheEntityBase {

    /** {@code VERIFY} — confirm the account email. */
    public static final String PURPOSE_VERIFY = "VERIFY";
    /** {@code RESET} — authorise a password reset. */
    public static final String PURPOSE_RESET = "RESET";
    /** {@code DELETE_ACCOUNT} — authorise permanent account deletion. */
    public static final String PURPOSE_DELETE_ACCOUNT = "DELETE_ACCOUNT";
    /** {@code DELETE_DATA} — authorise erasing content data while keeping the account. */
    public static final String PURPOSE_DELETE_DATA = "DELETE_DATA";

    @Id
    @Column(length = 36)
    public String id; // UUID

    @Column(nullable = false, length = 255)
    public String email;

    /** {@link #PURPOSE_VERIFY} | {@link #PURPOSE_RESET} | {@link #PURPOSE_DELETE_ACCOUNT} | {@link #PURPOSE_DELETE_DATA}. */
    @Column(nullable = false, length = 16)
    public String purpose;

    /** HMAC-SHA256 hex of the plaintext code (never the code itself). */
    @Column(name = "code_hash", nullable = false, length = 64)
    public String codeHash;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;

    /** Wrong-guess counter; the row is locked once it hits the configured max. */
    @Column(nullable = false)
    public int attempts;

    /** Single-use: flipped true once the code is redeemed. */
    @Column(nullable = false)
    public boolean consumed;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
