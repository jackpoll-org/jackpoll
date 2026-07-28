package org.acme.mail;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * The single way transactional mail leaves the app: hands out an
 * {@link EmailLayout} builder already carrying the branding every mail shares
 * (product URL, legal footer links) and sends the result as a
 * multipart HTML + plain-text message with the configured subject prefix.
 *
 * <p>Sending is best-effort — a broken or unconfigured SMTP setup is logged and
 * swallowed so it can never fail the request that triggered the mail. Callers
 * that need to report the outcome (the debug page's test mail) use
 * {@link #sendChecked}.
 */
@ApplicationScoped
public class BrandedMailer {

    private static final Logger LOG = Logger.getLogger(BrandedMailer.class);

    private static final MailCopy COPY = MailCopy.of("messages");

    @Inject
    Mailer mailer;

    @ConfigProperty(name = "survey.mail.subject-prefix", defaultValue = "[Survey School]")
    String subjectPrefix;

    @ConfigProperty(name = "survey.mail.app-url", defaultValue = "http://localhost:3000")
    String appUrl;


    /** Send in the background (the default). Off in tests, so the mock mailbox
     *  has the message by the time the assertion runs. */
    @ConfigProperty(name = "survey.mail.async", defaultValue = "true")
    boolean async;

    /** Daemon pool so background sends never keep the JVM alive. */
    private static final ExecutorService MAIL_EXECUTOR =
        Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "branded-email-dispatch");
            thread.setDaemon(true);
            return thread;
        });

    /** A layout pre-filled with the branding and footer links every mail shares,
     *  labelled in the recipient's language. */
    public EmailLayout.Builder layout(String locale) {
        String lang = MailCopy.normalize(locale);
        var builder = EmailLayout.builder().appUrl(appUrl);
        return builder;
    }

    /**
     * Send and swallow failures (logged) — the default for notification mail.
     * Dispatched off the request thread unless {@code survey.mail.async} is off
     * (as it is in tests, where the mock mailbox must be deterministic): an SMTP
     * server that is slow, or simply not listening, must never hold up the
     * response to the user whose action triggered the mail.
     */
    public void send(String to, String subject, EmailLayout.Rendered mail) {
        if (async) {
            MAIL_EXECUTOR.execute(() -> sendQuietly(to, subject, mail));
        } else {
            sendQuietly(to, subject, mail);
        }
    }

    private void sendQuietly(String to, String subject, EmailLayout.Rendered mail) {
        try {
            sendChecked(to, subject, mail);
        } catch (Exception e) {
            LOG.warnf("Email send failed (ignored): %s", e.getMessage());
        }
    }

    /** Send and let failures propagate, for callers that report the outcome. */
    public void sendChecked(String to, String subject, EmailLayout.Rendered mail) {
        mailer.send(Mail.withHtml(to, subject(subject), mail.html()).setText(mail.text()));
    }

    private String subject(String rawSubject) {
        return subjectPrefix.isBlank() ? rawSubject : subjectPrefix + " " + rawSubject;
    }
}
