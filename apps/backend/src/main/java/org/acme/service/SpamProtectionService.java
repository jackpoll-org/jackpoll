package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.acme.dto.SpamDtos.AltchaChallenge;
import org.acme.entity.SurveySettings;
import org.acme.exception.RateLimitedException;
import org.acme.exception.SpamRejectedException;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Layered, low-friction spam & bot protection for public submissions (#31):
 * honeypot, server-verified fill-time, per-IP rate limiting, a
 * one-per-browser guard, and an optional Altcha proof-of-work CAPTCHA.
 * All checks are enforced server-side; client hints are advisory.
 */
@ApplicationScoped
public class SpamProtectionService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long ALTCHA_MAX_NUMBER = 100_000L;
    private static final String GENERIC = "Your submission could not be processed.";

    @ConfigProperty(name = "survey.spam.secret", defaultValue = "change-me-spam-secret")
    String secret;

    @ConfigProperty(name = "survey.spam.rate-limit.max", defaultValue = "5")
    int rateLimitMax;

    @ConfigProperty(name = "survey.spam.rate-limit.window-seconds", defaultValue = "60")
    long rateLimitWindowSeconds;

    @jakarta.inject.Inject
    RateLimiterService rateLimiter;

    private final ObjectMapper mapper = new ObjectMapper();

    // ── Begin-token (server-verified fill-time) ───────────────────

    /** Issue a signed token capturing when the form was opened. */
    public String issueBeginToken(String surveyId) {
        long iat = Instant.now().getEpochSecond();
        String payload = surveyId + ":" + iat;
        return iat + "." + hmacHex(payload);
    }

    private void verifyTiming(String surveyId, String token, int minSeconds) {
        if (token == null || !token.contains(".")) throw spam();
        String[] parts = token.split("\\.", 2);
        long iat;
        try {
            iat = Long.parseLong(parts[0]);
        } catch (NumberFormatException e) {
            throw spam();
        }
        String expected = hmacHex(surveyId + ":" + iat);
        if (!constantTimeEquals(expected, parts[1])) throw spam();
        long elapsed = Instant.now().getEpochSecond() - iat;
        if (elapsed < minSeconds) throw spam();
    }

    // ── Rate limiting (per IP + survey) ───────────────────────────

    private void enforceRateLimit(String surveyId, String ip) {
        // Distributed-capable limiter (issue #42); memory backend by default.
        String key = surveyId + "|" + (ip == null ? "unknown" : ip);
        if (!rateLimiter.allow(key, rateLimitMax, rateLimitWindowSeconds)) {
            throw new RateLimitedException(
                "Too many submissions. Please wait a moment and try again.");
        }
    }

    // ── Altcha proof-of-work CAPTCHA ──────────────────────────────

    /** Build a fresh Altcha challenge for the widget. */
    public AltchaChallenge createChallenge() {
        byte[] saltBytes = new byte[12];
        RANDOM.nextBytes(saltBytes);
        String salt = HexFormat.of().formatHex(saltBytes);
        long number = (long) (RANDOM.nextDouble() * ALTCHA_MAX_NUMBER);
        String challenge = sha256Hex(salt + number);
        String signature = hmacHex(challenge);
        return new AltchaChallenge("SHA-256", challenge, ALTCHA_MAX_NUMBER, salt, signature);
    }

    private void verifyCaptcha(String payloadBase64) {
        if (payloadBase64 == null || payloadBase64.isBlank()) throw spam();
        try {
            byte[] decoded = Base64.getDecoder().decode(payloadBase64);
            JsonNode node = mapper.readTree(decoded);
            String salt = node.path("salt").asText();
            String challenge = node.path("challenge").asText();
            String signature = node.path("signature").asText();
            long number = node.path("number").asLong();

            String expectedChallenge = sha256Hex(salt + number);
            if (!constantTimeEquals(expectedChallenge, challenge)) throw spam();
            if (!constantTimeEquals(hmacHex(challenge), signature)) throw spam();
        } catch (SpamRejectedException e) {
            throw e;
        } catch (Exception e) {
            throw spam();
        }
    }

    // ── Orchestration ─────────────────────────────────────────────

    /**
     * Run all enabled checks for a submission. Returns the hashed client id to
     * persist (or null), or signals a silent honeypot reject to the caller.
     *
     * @return {@code true} when the honeypot was tripped — the caller should
     *         fake success without persisting; otherwise {@code false}.
     */
    public boolean check(
        String surveyId,
        SurveySettings settings,
        String ip,
        String honeypot,
        String beginToken,
        String clientId,
        String captcha) {

        // Honeypot is always on and adds no UI friction. A filled honeypot is a
        // bot → caller should silently fake success.
        if (honeypot != null && !honeypot.isBlank()) {
            return true;
        }

        if (settings == null) return false;

        if (settings.rateLimit) {
            enforceRateLimit(surveyId, ip);
        }
        if (settings.minSubmitSeconds != null && settings.minSubmitSeconds > 0) {
            verifyTiming(surveyId, beginToken, settings.minSubmitSeconds);
        }
        if (settings.requireCaptcha) {
            verifyCaptcha(captcha);
        }
        return false;
    }

    /** Hash a raw client id before storage (never persist the raw value). */
    public String hashClientId(String clientId) {
        if (clientId == null || clientId.isBlank()) return null;
        return sha256Hex("client:" + clientId);
    }

    private SpamRejectedException spam() {
        return new SpamRejectedException(GENERIC);
    }

    // ── Crypto helpers ────────────────────────────────────────────

    private String hmacHex(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failure", e);
        }
    }

    private String sha256Hex(String data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 failure", e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(
            a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
