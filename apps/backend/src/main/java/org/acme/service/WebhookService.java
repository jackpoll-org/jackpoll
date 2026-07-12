package org.acme.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.acme.dto.ResponseDtos.ResponseDto;
import org.acme.dto.WebhookDtos.CreateWebhookRequest;
import org.acme.dto.WebhookDtos.WebhookDto;
import org.acme.dto.WebhookDtos.WebhookTestResult;
import org.acme.entity.Webhook;
import org.acme.exception.ResourceNotFoundException;
import org.acme.exception.SpamRejectedException;
import org.acme.repository.WebhookRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Owner-configured outbound webhooks (issue #36). Deliveries are HMAC-signed,
 * sent off the request thread with retries, and best-effort — a failing or slow
 * endpoint never affects the respondent's submission.
 */
@ApplicationScoped
public class WebhookService {

    private static final Logger LOG = Logger.getLogger(WebhookService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 3;

    private static final ExecutorService POOL = Executors.newFixedThreadPool(4, r -> {
        var t = new Thread(r, "webhook-dispatch");
        t.setDaemon(true);
        return t;
    });

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        // Never follow redirects — a redirect can defeat the SSRF guard.
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    private final ObjectMapper mapper = new ObjectMapper();

    @Inject
    SurveyService surveyService;

    @Inject
    WebhookRepository webhooks;

    @ConfigProperty(name = "survey.webhook.allow-private", defaultValue = "false")
    boolean allowPrivate;

    @ConfigProperty(name = "survey.webhook.timeout-seconds", defaultValue = "10")
    long timeoutSeconds;

    // ── Owner CRUD ────────────────────────────────────────────────

    public List<WebhookDto> list(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        return webhooks.findBySurvey(surveyId).stream().map(this::toDto).toList();
    }

    @Transactional
    public WebhookDto create(String ownerId, String surveyId, CreateWebhookRequest req) {
        surveyService.requireOwner(ownerId, surveyId);
        validateUrl(req.url());
        var hook = new Webhook();
        hook.id = UUID.randomUUID().toString();
        hook.surveyId = surveyId;
        hook.url = req.url();
        hook.enabled = req.enabled();
        hook.secret = randomSecret();
        webhooks.persist(hook);
        return toDto(hook);
    }

    @Transactional
    public void delete(String ownerId, String surveyId, String webhookId) {
        surveyService.requireOwner(ownerId, surveyId);
        var hook = webhooks.findByIdAndSurvey(webhookId, surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Webhook not found"));
        webhooks.delete(hook);
    }

    /** Send a sample "ping" event synchronously and report the outcome. */
    public WebhookTestResult test(String ownerId, String surveyId, String webhookId) {
        surveyService.requireOwner(ownerId, surveyId);
        var hook = webhooks.findByIdAndSurvey(webhookId, surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Webhook not found"));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "ping");
        payload.put("surveyId", surveyId);
        payload.put("message", "This is a test event from Survey School.");
        payload.put("timestamp", Instant.now().toString());

        var outcome = deliverOnce(hook.url, hook.secret, "ping", toJson(payload));
        recordOutcome(hook.id, outcome);
        return new WebhookTestResult(outcome.status != null && outcome.status < 400,
            outcome.status, outcome.error);
    }

    // ── Dispatch on new response ──────────────────────────────────

    /**
     * Fire all enabled webhooks for a new response, off-thread and best-effort.
     * Must be called from within the submit transaction (loads hooks eagerly).
     */
    public void dispatchResponse(String surveyId, ResponseDto response) {
        var enabled = webhooks.findEnabledBySurvey(surveyId);
        if (enabled.isEmpty()) return;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "response.created");
        payload.put("surveyId", surveyId);
        payload.put("responseId", response.id());
        payload.put("submittedAt", response.submittedAt());
        payload.put("answers", response.answers());
        if (response.score() != null) {
            payload.put("score", response.score());
            payload.put("maxScore", response.maxScore());
            payload.put("passed", response.passed());
        }
        String body = toJson(payload);

        for (var hook : enabled) {
            String id = hook.id, url = hook.url, secret = hook.secret;
            POOL.execute(() -> {
                var outcome = deliverWithRetry(url, secret, "response.created", body);
                recordOutcome(id, outcome);
            });
        }
    }

    // ── Delivery ──────────────────────────────────────────────────

    private Outcome deliverWithRetry(String url, String secret, String event, String body) {
        Outcome last = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            last = deliverOnce(url, secret, event, body);
            if (last.status != null && last.status < 400) return last; // success
            if (attempt < MAX_ATTEMPTS) {
                try {
                    Thread.sleep((long) Math.pow(3, attempt) * 1000L); // 3s, 9s
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return last;
    }

    private Outcome deliverOnce(String url, String secret, String event, String body) {
        try {
            ensureAllowed(url);
            String timestamp = String.valueOf(Instant.now().getEpochSecond());
            String signature = "sha256=" + hmacHex(secret, timestamp + "." + body);
            var request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("User-Agent", "SurveySchool-Webhook/1")
                .header("X-Survey-Event", event)
                .header("X-Survey-Timestamp", timestamp)
                .header("X-Survey-Signature", signature)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
            var res = http.send(request, HttpResponse.BodyHandlers.discarding());
            return new Outcome(res.statusCode(), res.statusCode() >= 400 ? "HTTP " + res.statusCode() : null);
        } catch (SpamRejectedException e) {
            // SSRF guard rejected the URL.
            return new Outcome(null, e.getMessage());
        } catch (Exception e) {
            return new Outcome(null, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @Transactional
    void recordOutcomeTx(String webhookId, Outcome outcome) {
        var hook = webhooks.findById(webhookId);
        if (hook == null) return;
        hook.lastStatus = outcome.status;
        hook.lastError = outcome.error != null
            ? outcome.error.substring(0, Math.min(outcome.error.length(), 500)) : null;
        hook.lastDeliveryAt = Instant.now();
    }

    private void recordOutcome(String webhookId, Outcome outcome) {
        try {
            QuarkusTransaction.requiringNew().run(() -> recordOutcomeTx(webhookId, outcome));
        } catch (Exception e) {
            LOG.warnf("Failed to record webhook outcome: %s", e.getMessage());
        }
    }

    // ── SSRF guard ────────────────────────────────────────────────

    /** Reject obviously-internal targets unless explicitly allowed (dev). */
    private void validateUrl(String url) {
        try {
            ensureAllowed(url);
        } catch (SpamRejectedException e) {
            throw new SpamRejectedException(e.getMessage());
        }
    }

    private void ensureAllowed(String url) {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (Exception e) {
            throw new SpamRejectedException("Invalid webhook URL.");
        }
        var scheme = uri.getScheme();
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) {
            throw new SpamRejectedException("Webhook URL must use http or https.");
        }
        if (allowPrivate) return;
        try {
            for (InetAddress addr : InetAddress.getAllByName(uri.getHost())) {
                if (addr.isLoopbackAddress() || addr.isAnyLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isSiteLocalAddress()
                        || addr.isMulticastAddress()) {
                    throw new SpamRejectedException(
                        "Webhook URL must point to a public address.");
                }
            }
        } catch (SpamRejectedException e) {
            throw e;
        } catch (Exception e) {
            throw new SpamRejectedException("Webhook host could not be resolved.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private record Outcome(Integer status, String error) {}

    private String toJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize webhook payload", e);
        }
    }

    private String randomSecret() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return java.util.HexFormat.of().formatHex(bytes);
    }

    private String hmacHex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.HexFormat.of()
                .formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failure", e);
        }
    }

    private WebhookDto toDto(Webhook h) {
        return new WebhookDto(
            h.id, h.url, h.enabled, h.secret, h.lastStatus, h.lastError,
            h.lastDeliveryAt != null ? h.lastDeliveryAt.toString() : null,
            h.createdAt != null ? h.createdAt.toString() : null);
    }
}
