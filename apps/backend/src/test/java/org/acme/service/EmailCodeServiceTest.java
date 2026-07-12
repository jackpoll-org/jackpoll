package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.acme.entity.EmailCode;
import org.acme.repository.EmailCodeRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.mailer.MockMailbox;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

/**
 * Unit tests for {@link EmailCodeService}: issue → email → verify, plus expiry,
 * wrong-code attempt lockout, and single-use. Uses the mock mailbox to read the
 * delivered code (mirrors how a real user would).
 */
@QuarkusTest
class EmailCodeServiceTest {

    private static final Pattern SIX_DIGITS = Pattern.compile("\\b(\\d{6})\\b");

    @Inject
    EmailCodeService service;

    @Inject
    EmailCodeRepository codes;

    @Inject
    MockMailbox mailbox;

    private String issueAndReadCode(String email, String purpose) {
        mailbox.clear();
        service.issue(email, purpose);
        var messages = mailbox.getMessagesSentTo(email);
        assertTrue(!messages.isEmpty(), "a code email was sent");
        Matcher m = SIX_DIGITS.matcher(messages.get(0).getText());
        assertTrue(m.find(), "the email contains a 6-digit code");
        return m.group(1);
    }

    @Test
    void verifiesCorrectCodeOnce() {
        String email = "verify-ok@example.com";
        String code = issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);

        assertTrue(service.verify(email, EmailCode.PURPOSE_VERIFY, code));
        // Single-use: the same code cannot be redeemed twice.
        assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, code));
    }

    @Test
    void rejectsWrongCodeAndMissingActiveCode() {
        String email = "verify-wrong@example.com";
        issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);

        assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, "000000"));
        // A never-issued purpose has no active code.
        assertFalse(service.verify(email, EmailCode.PURPOSE_RESET, "123456"));
    }

    @Test
    void locksAfterTooManyWrongAttempts() {
        String email = "verify-lock@example.com";
        String code = issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);

        // Default max attempts is 5 — exhaust them with wrong guesses.
        for (int i = 0; i < 5; i++) {
            assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, "111111"));
        }
        // Even the correct code is now rejected (locked).
        assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, code));
    }

    @Test
    void rejectsExpiredCode() {
        String email = "verify-expired@example.com";
        String code = issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);
        expireCode(email, EmailCode.PURPOSE_VERIFY);

        assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, code));
    }

    @Test
    void issuingAgainReplacesTheOldCode() {
        String email = "verify-replace@example.com";
        String first = issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);
        String second = issueAndReadCode(email, EmailCode.PURPOSE_VERIFY);

        // The superseded code no longer works; the fresh one does.
        assertFalse(service.verify(email, EmailCode.PURPOSE_VERIFY, first));
        assertTrue(service.verify(email, EmailCode.PURPOSE_VERIFY, second));
    }

    @Test
    void normalizesEmailCaseAndWhitespace() {
        String code = issueAndReadCode("case@example.com", EmailCode.PURPOSE_RESET);
        assertTrue(service.verify("  CASE@Example.com ", EmailCode.PURPOSE_RESET, code));
    }

    /** Force the active code to expire (own transaction so the change commits). */
    void expireCode(String email, String purpose) {
        QuarkusTransaction.requiringNew().run(() -> {
            var row = codes.findActive(email, purpose).orElseThrow();
            row.expiresAt = Instant.now().minus(1, ChronoUnit.MINUTES);
        });
    }
}
