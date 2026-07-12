package org.acme.repository;

import java.time.Instant;
import java.util.Optional;

import org.acme.entity.EmailCode;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * Data access for {@link EmailCode}. One active code per {@code (email, purpose)}
 * — {@link #deleteByEmailAndPurpose} clears the old code before a new one is
 * issued, so {@link #findActive} returns at most one row.
 */
@ApplicationScoped
public class EmailCodeRepository implements PanacheRepositoryBase<EmailCode, String> {

    /** The current, unconsumed code for this email + purpose, if any. */
    public Optional<EmailCode> findActive(String email, String purpose) {
        return find("email = ?1 and purpose = ?2 and consumed = false"
            + " order by createdAt desc", email, purpose).firstResultOptional();
    }

    /** Drop every prior code for this email + purpose (called before issuing). */
    public long deleteByEmailAndPurpose(String email, String purpose) {
        return delete("email = ?1 and purpose = ?2", email, purpose);
    }

    /** Sweep expired/consumed rows so the table doesn't grow unbounded. */
    public long deleteExpiredBefore(Instant cutoff) {
        return delete("expiresAt < ?1 or consumed = true", cutoff);
    }
}
