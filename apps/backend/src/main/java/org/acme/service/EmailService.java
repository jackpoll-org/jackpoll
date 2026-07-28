package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.Survey;
import org.acme.mail.BrandedMailer;
import org.acme.mail.EmailLayout;
import org.acme.mail.MailCopy;
import org.acme.repository.NotificationPreferenceRepository;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Renders and sends notification &amp; receipt emails (issue #24). Bodies are
 * rendered at send time from {@link EmailLayout} — the product's own design
 * tokens in email-safe HTML — and never stored. Every mail goes out as HTML with
 * an equivalent plain-text part, so a text-only client still gets the whole
 * message including its links. Sending is best-effort: failures are logged and
 * never propagated to the caller.
 *
 * <p>Copy comes from {@link MailCopy} in the recipient's own language. The
 * language is resolved here, from the recipient's address, rather than threaded
 * through every caller: whoever triggered the mail (a respondent submitting a
 * form, a scheduler, another user) is rarely the person who will read it.
 */
@ApplicationScoped
public class EmailService {

    private static final Logger LOG = Logger.getLogger(EmailService.class);

    private static final MailCopy COPY = MailCopy.of("messages");

    @Inject
    BrandedMailer mailer;

    @Inject
    UserRepository users;

    @Inject
    SurveyRepository surveys;

    @Inject
    ResponseRepository responses;

    @Inject
    NotificationPreferenceRepository notificationPrefs;

    @ConfigProperty(name = "survey.mail.app-url", defaultValue = "http://localhost:3000")
    String appUrl;

    @ConfigProperty(name = "survey.mail.unsubscribe-secret", defaultValue = "change-me-mail-secret")
    String unsubscribeSecret;

    // ── Owner notification (per response) ─────────────────────────

    public void sendOwnerNotification(String ownerEmail, String surveyId, String surveyTitle) {
        if (blank(ownerEmail)) return;
        String lang = localeFor(ownerEmail);
        String title = safeTitle(surveyTitle, lang);
        String unsubscribe = appUrl + "/api/public/notifications/unsubscribe/"
            + surveyId + "/" + unsubscribeToken(surveyId);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "owner.preheader", title))
            .heading(COPY.t(lang, "owner.heading"))
            .paragraph(COPY.t(lang, "owner.body", title))
            .button(COPY.t(lang, "owner.cta"), appUrl + "/surveys/" + surveyId + "/results")
            .footerNote(COPY.t(lang, "owner.footer"))
            .footerLink(COPY.t(lang, "owner.unsubscribe"), unsubscribe)
            .build();
        mailer.send(ownerEmail, COPY.t(lang, "owner.subject", title), mail);
    }

    // ── Respondent receipt ────────────────────────────────────────

    /**
     * Confirm a submitted response to the respondent. They have no account, so
     * their language is unknown here — the caller passes the language the survey
     * was answered in.
     */
    public void sendReceipt(String toEmail, String surveyTitle, boolean isQuiz,
                            Integer score, Integer maxScore, String locale) {
        if (blank(toEmail)) return;
        String lang = MailCopy.normalize(locale);
        String title = safeTitle(surveyTitle, lang);
        var builder = layout(lang)
            .preheader(COPY.t(lang, "receipt.preheader", title))
            .heading(COPY.t(lang, "receipt.heading"))
            .paragraph(COPY.t(lang, "receipt.body", title));
        if (isQuiz && score != null) {
            builder.row(COPY.t(lang, "receipt.score"),
                maxScore != null ? score + " / " + maxScore : String.valueOf(score));
        }
        var mail = builder.footerNote(COPY.t(lang, "receipt.footer")).build();
        mailer.send(toEmail, COPY.t(lang, "receipt.subject", title), mail);
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
            if (!notificationPrefs.isEnabled(survey.ownerId,
                    NotificationEventType.DAILY_DIGEST.key(), NotificationChannel.EMAIL.key())) {
                continue;
            }
            var owner = users.findByIdOptional(survey.ownerId).orElse(null);
            if (owner == null || blank(owner.email)) continue;
            String lang = MailCopy.normalize(owner.locale);
            String title = safeTitle(survey.title, lang);
            String unsubscribe = appUrl + "/api/public/notifications/unsubscribe/"
                + survey.id + "/" + unsubscribeToken(survey.id);
            var mail = layout(lang)
                .preheader(COPY.t(lang, "digest.preheader", count))
                .heading(COPY.t(lang, "digest.heading"))
                .paragraph(COPY.t(lang, "digest.body", title, count))
                .button(COPY.t(lang, "digest.cta"),
                    appUrl + "/surveys/" + survey.id + "/results")
                .footerNote(COPY.t(lang, "digest.footer"))
                .footerLink(COPY.t(lang, "owner.unsubscribe"), unsubscribe)
                .build();
            mailer.send(owner.email, COPY.t(lang, "digest.subject", title), mail);
        }
    }

    // ── Response milestone (#89) ──────────────────────────────────

    public void sendMilestoneNotification(String toEmail, String surveyTitle, int milestone) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "milestone.preheader", title, milestone))
            .heading(COPY.t(lang, "milestone.heading"))
            .paragraph(COPY.t(lang, "milestone.body", title, milestone))
            .button(COPY.t(lang, "common.open"), appUrl)
            .footerNote(COPY.t(lang, "milestone.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "milestone.subject", title), mail);
    }

    // ── Collaboration (#89) ───────────────────────────────────────

    public void sendCollaboratorInvite(String toEmail, String surveyTitle, String inviterName) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "collab.invite.preheader", inviterName, title))
            .heading(COPY.t(lang, "collab.invite.heading"))
            .paragraph(COPY.t(lang, "collab.invite.body", inviterName, title))
            .paragraph(COPY.t(lang, "collab.invite.body2"))
            .button(COPY.t(lang, "common.open"), appUrl)
            .footerNote(COPY.t(lang, "collab.invite.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "collab.invite.subject", inviterName), mail);
    }

    public void sendCollaboratorAccepted(
        String toEmail, String surveyTitle, String collaboratorName) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "collab.accepted.preheader", collaboratorName))
            .heading(COPY.t(lang, "collab.accepted.heading"))
            .paragraph(COPY.t(lang, "collab.accepted.body", collaboratorName, title))
            .button(COPY.t(lang, "common.open"), appUrl)
            .footerNote(COPY.t(lang, "collab.accepted.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "collab.accepted.subject", collaboratorName), mail);
    }

    public void sendCollaboratorDeclined(
        String toEmail, String surveyTitle, String collaboratorName) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "collab.declined.preheader", collaboratorName))
            .heading(COPY.t(lang, "collab.declined.heading"))
            .paragraph(COPY.t(lang, "collab.declined.body", collaboratorName, title))
            .footerNote(COPY.t(lang, "collab.declined.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "collab.declined.subject", collaboratorName), mail);
    }

    public void sendCollaboratorRemoved(String toEmail, String surveyTitle, String ownerName) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "collab.removed.preheader", title))
            .heading(COPY.t(lang, "collab.removed.heading"))
            .paragraph(COPY.t(lang, "collab.removed.body", ownerName, title))
            .muted(COPY.t(lang, "collab.removed.note"))
            .footerNote(COPY.t(lang, "collab.removed.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "collab.removed.subject", title), mail);
    }

    // ── Survey auto-closed (#89) ──────────────────────────────────

    public void sendSurveyAutoClosed(String toEmail, String surveyTitle) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "autoclose.preheader", title))
            .heading(COPY.t(lang, "autoclose.heading"))
            .paragraph(COPY.t(lang, "autoclose.body", title))
            .button(COPY.t(lang, "common.open"), appUrl)
            .footerNote(COPY.t(lang, "autoclose.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "autoclose.subject", title), mail);
    }

    // ── Webhook failing (#89) ─────────────────────────────────────

    public void sendWebhookFailing(String toEmail, String surveyTitle, String webhookUrl) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        String title = safeTitle(surveyTitle, lang);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "webhook.preheader", title))
            .heading(COPY.t(lang, "webhook.heading"))
            .paragraph(COPY.t(lang, "webhook.body", title))
            .row(COPY.t(lang, "webhook.endpoint"), webhookUrl)
            .row(COPY.t(lang, "webhook.survey"), title)
            .paragraph(COPY.t(lang, "webhook.body2"))
            .button(COPY.t(lang, "common.open"), appUrl)
            .footerNote(COPY.t(lang, "webhook.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "webhook.subject", title), mail);
    }

    // ── Account email codes (#security email-verify) ──────────────

    /** Email a 6-digit address-verification code. Best-effort (logged on failure);
     *  the user can request a resend. */
    public void sendVerificationCode(String toEmail, String code, long ttlMinutes) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "verify.preheader", code))
            .heading(COPY.t(lang, "verify.heading"))
            .paragraph(COPY.t(lang, "verify.body"))
            .code(code)
            .muted(COPY.t(lang, "common.code.expires", ttlMinutes))
            .note(COPY.t(lang, "verify.note"))
            .footerNote(COPY.t(lang, "verify.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "verify.subject", code), mail);
    }

    /** Email a 6-digit password-reset code. Best-effort (logged on failure). */
    public void sendPasswordResetCode(String toEmail, String code, long ttlMinutes) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "reset.preheader", code))
            .heading(COPY.t(lang, "reset.heading"))
            .paragraph(COPY.t(lang, "reset.body"))
            .code(code)
            .muted(COPY.t(lang, "common.code.expires", ttlMinutes))
            .note(COPY.t(lang, "reset.note"))
            .footerNote(COPY.t(lang, "reset.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "reset.subject", code), mail);
    }

    /** Email a 6-digit code authorising permanent account deletion. Best-effort. */
    public void sendDeleteAccountCode(String toEmail, String code, long ttlMinutes) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "deleteaccount.preheader", code))
            .heading(COPY.t(lang, "deleteaccount.heading"))
            .paragraph(COPY.t(lang, "deleteaccount.body"))
            .code(code)
            .note(COPY.t(lang, "deleteaccount.note"))
            .muted(COPY.t(lang, "common.code.expires", ttlMinutes) + " "
                + COPY.t(lang, "deleteaccount.muted"))
            .footerNote(COPY.t(lang, "deleteaccount.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "deleteaccount.subject", code), mail);
    }

    /** Email a 6-digit code authorising deletion of a user's content data
     *  while keeping their account and login active. Best-effort. */
    public void sendDeleteDataCode(String toEmail, String code, long ttlMinutes) {
        if (blank(toEmail)) return;
        String lang = localeFor(toEmail);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "deletedata.preheader", code))
            .heading(COPY.t(lang, "deletedata.heading"))
            .paragraph(COPY.t(lang, "deletedata.body"))
            .code(code)
            .note(COPY.t(lang, "deletedata.note"))
            .muted(COPY.t(lang, "common.code.expires", ttlMinutes) + " "
                + COPY.t(lang, "deletedata.muted"))
            .footerNote(COPY.t(lang, "deletedata.footer"))
            .build();
        mailer.send(toEmail, COPY.t(lang, "deletedata.subject", code), mail);
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
        String lang = localeFor(toEmail);
        var mail = layout(lang)
            .preheader(COPY.t(lang, "test.preheader"))
            .heading(COPY.t(lang, "test.heading"))
            .paragraph(COPY.t(lang, "test.body"))
            .footerNote(COPY.t(lang, "test.footer"))
            .build();
        try {
            mailer.sendChecked(toEmail, COPY.t(lang, "test.subject"), mail);
            return true;
        } catch (Exception e) {
            LOG.warnf("Test email failed: %s", e.getMessage());
            return false;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private EmailLayout.Builder layout(String locale) {
        return mailer.layout(locale);
    }

    /**
     * The language to write to this address in: the recipient's account setting
     * when they have an account, English otherwise. Deliberately a lookup and not
     * a parameter — most of these mails are triggered by someone other than the
     * recipient (a respondent, a collaborator, the scheduler).
     */
    private String localeFor(String email) {
        if (blank(email)) return MailCopy.DEFAULT_LOCALE;
        return users.findByEmail(email.trim().toLowerCase())
            .map(u -> MailCopy.normalize(u.locale))
            .orElse(MailCopy.DEFAULT_LOCALE);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String safeTitle(String title, String locale) {
        return blank(title) ? COPY.t(locale, "common.untitled") : title;
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
