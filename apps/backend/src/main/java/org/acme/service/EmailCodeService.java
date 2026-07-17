package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.acme.entity.EmailCode;
import org.acme.repository.EmailCodeRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Issues and verifies short-lived, single-use email codes for address
 * verification and password reset (#security email-verify). The 6-digit code is
 * emailed via the backend {@link EmailService} (reusing the app's working SMTP,
 * not Keycloak's) and only its HMAC hash is persisted. Verification is
 * constant-time, expiry- and attempt-limited, and single-use.
 *
 * <p>This service owns the code channel only; the durable "verified" state lives
 * in Keycloak (the token's {@code email_verified} claim) and is flipped by the
 * caller after {@link #verify} succeeds.
 */
@ApplicationScoped
public class EmailCodeService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int CODE_BOUND = 1_000_000; // 6 digits: 000000–999999

    @Inject
    EmailCodeRepository codes;

    @Inject
    EmailService emailService;

    @ConfigProperty(name = "survey.auth.email-code.ttl-minutes", defaultValue = "15")
    long ttlMinutes;

    @ConfigProperty(name = "survey.auth.email-code.max-attempts", defaultValue = "5")
    int maxAttempts;

    /** HMAC key for hashing codes at rest. Set EMAIL_CODE_SECRET in production. */
    @ConfigProperty(name = "survey.auth.email-code.secret",
        defaultValue = "change-me-email-code-secret")
    String secret;

    /**
     * Generate a fresh code for {@code (email, purpose)}, replacing any prior one,
     * store its hash, and email the plaintext. Returns the plaintext code so tests
     * (and only tests) can assert on it — production callers ignore it and rely on
     * the delivered email.
     */
    @Transactional
    public String issue(String email, String purpose) {
        String normalized = normalize(email);
        codes.deleteByEmailAndPurpose(normalized, purpose);

        String code = generateCode();
        var row = new EmailCode();
        row.id = UUID.randomUUID().toString();
        row.email = normalized;
        row.purpose = purpose;
        row.codeHash = hash(purpose, normalized, code);
        row.expiresAt = Instant.now().plus(ttlMinutes, ChronoUnit.MINUTES);
        row.attempts = 0;
        row.consumed = false;
        row.createdAt = Instant.now();
        codes.persist(row);

        switch (purpose) {
            case EmailCode.PURPOSE_RESET -> emailService.sendPasswordResetCode(normalized, code, ttlMinutes);
            case EmailCode.PURPOSE_DELETE_ACCOUNT -> emailService.sendDeleteAccountCode(normalized, code, ttlMinutes);
            case EmailCode.PURPOSE_DELETE_DATA -> emailService.sendDeleteDataCode(normalized, code, ttlMinutes);
            default -> emailService.sendVerificationCode(normalized, code, ttlMinutes);
        }
        return code;
    }

    /**
     * Verify a submitted code for {@code (email, purpose)}. Returns true exactly
     * once for a valid, unexpired, unlocked code, consuming it. A wrong guess
     * increments the attempt counter and locks the code at the configured max; an
     * expired or missing code returns false without leaking which.
     */
    @Transactional
    public boolean verify(String email, String purpose, String submittedCode) {
        if (submittedCode == null || submittedCode.isBlank()) return false;
        String normalized = normalize(email);
        var row = codes.findActive(normalized, purpose).orElse(null);
        if (row == null) return false;

        // Expired or locked: treat as invalid (and clear expired rows eagerly).
        if (row.expiresAt.isBefore(Instant.now())) {
            codes.delete(row);
            return false;
        }
        if (row.attempts >= maxAttempts) return false;

        String expected = row.codeHash;
        String actual = hash(purpose, normalized, submittedCode.trim());
        boolean match = constantTimeEquals(expected, actual);
        if (!match) {
            row.attempts += 1; // managed entity: flushed on commit
            return false;
        }
        row.consumed = true;
        return true;
    }

    /** Hourly sweep of expired/consumed rows (defence-in-depth cleanup). */
    @Scheduled(cron = "{survey.auth.email-code.sweep-cron:0 30 * * * ?}")
    @Transactional
    void sweepExpired() {
        codes.deleteExpiredBefore(Instant.now());
    }

    // ── Helpers ───────────────────────────────────────────────────

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String generateCode() {
        return String.format("%06d", RANDOM.nextInt(CODE_BOUND));
    }

    private String hash(String purpose, String email, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(
                (purpose + ":" + email + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failure", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
            a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
