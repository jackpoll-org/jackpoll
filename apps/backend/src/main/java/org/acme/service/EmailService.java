package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.acme.entity.Survey;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Renders and sends notification & receipt emails (issue #24). Bodies are
 * rendered from inline templates at send time (never stored). Sending is
 * best-effort: failures are logged and never propagated to the caller.
 */
@ApplicationScoped
public class EmailService {

    private static final Logger LOG = Logger.getLogger(EmailService.class);

    @Inject
    Mailer mailer;

    @Inject
    UserRepository users;

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseRepository responses;

    @ConfigProperty(name = "survey.mail.subject-prefix", defaultValue = "[Survey School]")
    String subjectPrefix;

    @ConfigProperty(name = "survey.mail.app-url", defaultValue = "http://localhost:3000")
    String appUrl;

    @ConfigProperty(name = "survey.mail.unsubscribe-secret", defaultValue = "change-me-mail-secret")
    String unsubscribeSecret;

    // ── Owner notification (per response) ─────────────────────────

    public void sendOwnerNotification(String ownerEmail, String surveyId, String surveyTitle) {
        if (ownerEmail == null || ownerEmail.isBlank()) return;
        String subject = subjectPrefix + " New response: " + safeTitle(surveyTitle);
        String results = appUrl + "/surveys/" + surveyId + "/results";
        String unsubscribe = appUrl + "/api/public/notifications/unsubscribe/"
            + surveyId + "/" + unsubscribeToken(surveyId);
        String body = """
            You received a new response to "%s".

            View results: %s

            ──
            To stop these notifications, open:
            %s
            """.formatted(safeTitle(surveyTitle), results, unsubscribe);
        safeSend(Mail.withText(ownerEmail, subject, body));
    }

    // ── Respondent receipt ────────────────────────────────────────

    public void sendReceipt(
        String toEmail, String surveyTitle, boolean isQuiz, Integer score, Integer maxScore) {
        if (toEmail == null || toEmail.isBlank()) return;
        String subject = subjectPrefix + " Your response to " + safeTitle(surveyTitle);
        StringBuilder body = new StringBuilder();
        body.append("Thanks for completing \"").append(safeTitle(surveyTitle)).append("\".\n\n");
        body.append("This confirms we received your response.\n");
        if (isQuiz && score != null) {
            body.append("\nYour score: ").append(score);
            if (maxScore != null) body.append(" / ").append(maxScore);
            body.append('\n');
        }
        safeSend(Mail.withText(toEmail, subject, body.toString()));
    }

    // ── Daily digest (scheduled) ──────────────────────────────────

    @Scheduled(cron = "{survey.mail.digest-cron:0 0 7 * * ?}")
    void sendDailyDigests() {
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        for (Survey survey : surveys.listAll()) {
            if (survey.settings == null || !"daily".equals(survey.settings.ownerNotify)) continue;
            long count = responses.countBySurveySince(survey.id, since);
            if (count == 0) continue;
            // Respect the owner's account-level daily-digest email pref (#89).
            String ownerEmail = users.findByIdOptional(survey.ownerId)
                .filter(u -> u.notifyDailyDigestEmail)
                .map(u -> u.email).orElse(null);
            if (ownerEmail == null) continue;
            String subject = subjectPrefix + " Daily digest: " + safeTitle(survey.title);
            String body = """
                "%s" received %d new response(s) in the last 24 hours.

                View results: %s
                """.formatted(safeTitle(survey.title), count,
                    appUrl + "/surveys/" + survey.id + "/results");
            safeSend(Mail.withText(ownerEmail, subject, body));
        }
    }

    // ── Account email codes (#security email-verify) ──────────────

    /** Email a 6-digit address-verification code. Best-effort (logged on failure);
     *  the user can request a resend. */
    public void sendVerificationCode(String toEmail, String code, long ttlMinutes) {
        if (toEmail == null || toEmail.isBlank()) return;
        String subject = subjectPrefix + " Your verification code: " + code;
        String body = """
            Welcome to Jackpoll!

            Your email verification code is:

                %s

            Enter it in the app to activate your account. The code expires in
            %d minutes. If you didn't create an account, you can ignore this email.
            """.formatted(code, ttlMinutes);
        safeSend(Mail.withText(toEmail, subject, body));
    }

    /** Email a 6-digit password-reset code. Best-effort (logged on failure). */
    public void sendPasswordResetCode(String toEmail, String code, long ttlMinutes) {
        if (toEmail == null || toEmail.isBlank()) return;
        String subject = subjectPrefix + " Your password reset code: " + code;
        String body = """
            We received a request to reset your Jackpoll password.

            Your password reset code is:

                %s

            Enter it in the app to choose a new password. The code expires in
            %d minutes. If you didn't request this, you can ignore this email —
            your password stays unchanged.
            """.formatted(code, ttlMinutes);
        safeSend(Mail.withText(toEmail, subject, body));
    }

    /** Email a 6-digit code authorising permanent account deletion. Best-effort. */
    public void sendDeleteAccountCode(String toEmail, String code, long ttlMinutes) {
        if (toEmail == null || toEmail.isBlank()) return;
        String subject = subjectPrefix + " Confirm account deletion: " + code;
        String body = """
            We received a request to permanently delete your Jackpoll account.

            Your confirmation code is:

                %s

            Entering it will permanently delete your account, including your
            surveys, responses, and uploaded files. This cannot be undone.
            The code expires in %d minutes. If you didn't request this, you
            can ignore this email — your account stays unchanged.
            """.formatted(code, ttlMinutes);
        safeSend(Mail.withText(toEmail, subject, body));
    }

    /** Email a 6-digit code authorising deletion of a user's content data
     *  while keeping their account and login active. Best-effort. */
    public void sendDeleteDataCode(String toEmail, String code, long ttlMinutes) {
        if (toEmail == null || toEmail.isBlank()) return;
        String subject = subjectPrefix + " Confirm data deletion: " + code;
        String body = """
            We received a request to delete the data in your Jackpoll account.

            Your confirmation code is:

                %s

            Entering it will permanently delete your surveys, responses, and
            uploaded files. Your account and login stay active. This cannot
            be undone. The code expires in %d minutes. If you didn't request
            this, you can ignore this email — nothing will be deleted.
            """.formatted(code, ttlMinutes);
        safeSend(Mail.withText(toEmail, subject, body));
    }

    // ── Unsubscribe token ─────────────────────────────────────────

    public String unsubscribeToken(String surveyId) {
        return hmacHex("unsubscribe:" + surveyId);
    }

    /** Turn off owner notifications for a survey via a signed token. */
    @Transactional
    public boolean unsubscribe(String surveyId, String token) {
        if (!hmacHex("unsubscribe:" + surveyId).equals(token)) return false;
        Survey survey = surveys.findById(surveyId);
        if (survey == null) return false;
        if (survey.settings != null) survey.settings.ownerNotify = "off";
        return true;
    }

    // ── Diagnostics (debug page) ──────────────────────────────────

    /**
     * Send a diagnostic test email. Unlike the best-effort helpers this reports
     * the outcome so the debug page can show "sent" vs "SMTP not configured".
     */
    public boolean sendTestEmail(String toEmail) {
        String subject = subjectPrefix + " Test email";
        String body = "This is a test email from Jackpoll. "
            + "If you received it, your email (SMTP) settings are working.";
        try {
            mailer.send(Mail.withText(toEmail, subject, body));
            return true;
        } catch (Exception e) {
            LOG.warnf("Test email failed: %s", e.getMessage());
            return false;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private void safeSend(Mail mail) {
        try {
            mailer.send(mail);
        } catch (Exception e) {
            LOG.warnf("Email send failed (ignored): %s", e.getMessage());
        }
    }

    private String safeTitle(String title) {
        return (title == null || title.isBlank()) ? "Untitled survey" : title;
    }

    private String hmacHex(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                unsubscribeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failure", e);
        }
    }
}
