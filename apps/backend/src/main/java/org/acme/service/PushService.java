package org.acme.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Security;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

import org.acme.entity.DeviceToken;
import org.acme.repository.DeviceTokenRepository;
import org.acme.repository.UserRepository;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Push notifications to a user's registered devices (mobile app) via the
 * <b>FCM HTTP v1</b> API. Sending is optional and env-gated
 * ({@code survey.push.*}): without a configured Firebase service account it is a
 * no-op, so dev/test need no project. Token registration always works; delivery
 * is best-effort and off the request thread. Tokens FCM reports as unregistered
 * are pruned.
 */
@ApplicationScoped
public class PushService {

    private static final Logger LOG = Logger.getLogger(PushService.class);
    private static final String FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @ConfigProperty(name = "survey.push.enabled", defaultValue = "false")
    boolean enabled;

    /** Firebase service-account: either inline JSON or a path to the JSON file. */
    @ConfigProperty(name = "survey.push.fcm.service-account")
    Optional<String> serviceAccountConfig;

    // ── Web Push (VAPID) config (#74) ──────────────────────────────
    /** VAPID public key (base64url, uncompressed P-256 point). */
    @ConfigProperty(name = "survey.push.vapid.public-key")
    Optional<String> vapidPublicKey;

    /** VAPID private key (base64url, 32-byte scalar). */
    @ConfigProperty(name = "survey.push.vapid.private-key")
    Optional<String> vapidPrivateKey;

    /** VAPID subject — a mailto: or https: contact for the push service. */
    @ConfigProperty(name = "survey.push.vapid.subject", defaultValue = "mailto:admin@jackpoll.app")
    String vapidSubject;

    @Inject
    DeviceTokenRepository devices;

    @Inject
    UserRepository users;

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    private static final ExecutorService PUSH_EXECUTOR =
        Executors.newSingleThreadExecutor(r -> {
            var t = new Thread(r, "push-dispatch");
            t.setDaemon(true);
            return t;
        });

    /** Parsed once, lazily. */
    private volatile ServiceAccount account;
    private volatile boolean accountParseFailed;
    private final AtomicReference<AccessToken> cachedToken = new AtomicReference<>();

    /** Web Push client, built lazily from the VAPID keys (#74). */
    private volatile nl.martijndwars.webpush.PushService webPush;
    private volatile boolean webPushInitFailed;

    record ServiceAccount(String projectId, String clientEmail, PrivateKey privateKey, String tokenUri) {}

    private record AccessToken(String value, Instant expiresAt) {}

    private enum SendResult { OK, INVALID_TOKEN, ERROR }

    private boolean configured() {
        return enabled && account() != null;
    }

    /** Web Push is usable once a VAPID key pair is configured. */
    private boolean webConfigured() {
        return webPushClient() != null;
    }

    // ── Registration ──────────────────────────────────────────────

    /** Register (or re-assign) a native (FCM/APNs) device token to a user. */
    @Transactional
    public void register(String userId, String token, String platform) {
        register(userId, token, platform, null, null);
    }

    /**
     * Register (or re-assign) a device to a user. Web Push subscriptions
     * (platform "web") carry the {@code p256dh}/{@code auth} encryption keys;
     * native tokens leave them null.
     */
    @Transactional
    public void register(String userId, String token, String platform,
                         String p256dh, String auth) {
        var existing = devices.findByToken(token).orElse(null);
        if (existing != null) {
            existing.userId = userId;
            existing.platform = platform;
            existing.p256dh = p256dh;
            existing.auth = auth;
            return;
        }
        var device = new DeviceToken();
        device.id = UUID.randomUUID().toString();
        device.userId = userId;
        device.token = token;
        device.platform = platform;
        device.p256dh = p256dh;
        device.auth = auth;
        devices.persist(device);
    }

    /** Remove a device token (e.g. on logout). */
    @Transactional
    public void unregister(String userId, String token) {
        devices.findByToken(token)
            .filter(d -> d.userId.equals(userId))
            .ifPresent(devices::delete);
    }

    // ── Sending ───────────────────────────────────────────────────

    /** Immutable snapshot of a device, read inside the caller's transaction. */
    private record Target(String token, String platform, String p256dh, String auth) {
        boolean isWeb() { return "web".equals(platform); }
    }

    /**
     * Best-effort push to every device of {@code userId}. Native devices go via
     * FCM, browsers via Web Push (VAPID); each channel is independently
     * env-gated. Reads the devices in the caller's transaction, then sends
     * off-thread. No-op when neither channel is configured.
     */
    public void notifyUser(String userId, String title, String body) {
        boolean fcm = configured();
        boolean web = webConfigured();
        if (!fcm && !web) return;
        // Account-level channel preferences (issue #89): skip a channel the
        // owner has switched off. Missing user → treat as all-on (defaults).
        var prefs = users.findByIdOptional(userId).orElse(null);
        final boolean wantMobile = prefs == null || prefs.notifyNewResponseMobile;
        final boolean wantWeb = prefs == null || prefs.notifyNewResponseWeb;
        if (!wantMobile && !wantWeb) return;
        List<Target> targets = devices.findByUser(userId).stream()
            .map(d -> new Target(d.token, d.platform, d.p256dh, d.auth))
            .toList();
        if (targets.isEmpty()) return;
        PUSH_EXECUTOR.execute(() -> {
            for (var target : targets) {
                SendResult result;
                if (target.isWeb()) {
                    if (!web || !wantWeb) continue;
                    result = sendWebPush(target, title, body);
                } else {
                    if (!fcm || !wantMobile) continue;
                    result = send(target.token(), title, body);
                }
                if (result == SendResult.INVALID_TOKEN) {
                    pruneToken(target.token());
                }
            }
        });
    }

    private SendResult send(String token, String title, String body) {
        try {
            String accessToken = accessToken();
            if (accessToken == null) return SendResult.ERROR;
            var acct = account();
            String url = "https://fcm.googleapis.com/v1/projects/"
                + acct.projectId() + "/messages:send";
            var request = HttpRequest.newBuilder(URI.create(url))
                .header("Authorization", "Bearer " + accessToken)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(buildV1Payload(token, title, body)))
                .build();
            var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) return SendResult.OK;
            // A stale/unregistered token returns 404 (or NOT_FOUND/UNREGISTERED).
            if (response.statusCode() == 404 || response.body().contains("UNREGISTERED")
                || response.body().contains("NOT_FOUND")) {
                return SendResult.INVALID_TOKEN;
            }
            LOG.debugf("FCM send returned %d: %s", response.statusCode(), response.body());
            return SendResult.ERROR;
        } catch (Exception e) {
            LOG.debugf(e, "push send failed for one device");
            return SendResult.ERROR;
        }
    }

    private void pruneToken(String token) {
        try {
            QuarkusTransaction.requiringNew().run(() ->
                devices.findByToken(token).ifPresent(devices::delete));
        } catch (Exception e) {
            LOG.debugf(e, "could not prune stale token");
        }
    }

    /** Build the FCM v1 message body for a single device. */
    static String buildV1Payload(String token, String title, String body) {
        return "{\"message\":{\"token\":" + json(token)
            + ",\"notification\":{\"title\":" + json(title)
            + ",\"body\":" + json(body) + "}}}";
    }

    // ── Web Push (VAPID, RFC 8291) ─────────────────────────────────

    /** The configured VAPID public key for browsers to subscribe with (#74). */
    public Optional<String> webPushPublicKey() {
        return webConfigured() ? vapidPublicKey.map(String::strip) : Optional.empty();
    }

    /** Lazily build (and cache) the Web Push client from the VAPID key pair. */
    private nl.martijndwars.webpush.PushService webPushClient() {
        if (webPush != null) return webPush;
        if (webPushInitFailed) return null;
        if (vapidPublicKey.isEmpty() || vapidPrivateKey.isEmpty()
            || vapidPublicKey.get().isBlank() || vapidPrivateKey.get().isBlank()) {
            webPushInitFailed = true;
            return null;
        }
        synchronized (this) {
            if (webPush != null) return webPush;
            if (webPushInitFailed) return null;
            try {
                if (Security.getProvider("BC") == null) {
                    Security.addProvider(new BouncyCastleProvider());
                }
                webPush = new nl.martijndwars.webpush.PushService(
                    vapidPublicKey.get().strip(), vapidPrivateKey.get().strip(), vapidSubject);
                return webPush;
            } catch (Exception e) {
                LOG.warnf(e, "failed to init Web Push client (bad VAPID keys?)");
                webPushInitFailed = true;
                return null;
            }
        }
    }

    private SendResult sendWebPush(Target target, String title, String body) {
        var client = webPushClient();
        if (client == null) return SendResult.ERROR;
        // A web subscription without its encryption keys can never be delivered.
        if (target.p256dh() == null || target.auth() == null) return SendResult.INVALID_TOKEN;
        try {
            var subscription = new nl.martijndwars.webpush.Subscription(
                target.token(),
                new nl.martijndwars.webpush.Subscription.Keys(target.p256dh(), target.auth()));
            var notification = new nl.martijndwars.webpush.Notification(
                subscription, buildWebPayload(title, body));
            var response = client.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status >= 200 && status < 300) return SendResult.OK;
            // 404 Not Found / 410 Gone = the subscription expired or the user
            // unsubscribed → drop it.
            if (status == 404 || status == 410) return SendResult.INVALID_TOKEN;
            LOG.debugf("web push returned %d", status);
            return SendResult.ERROR;
        } catch (Exception e) {
            LOG.debugf(e, "web push send failed for one device");
            return SendResult.ERROR;
        }
    }

    /** Payload read by the service worker's push handler (event.data.json()). */
    static String buildWebPayload(String title, String body) {
        return "{\"title\":" + json(title) + ",\"body\":" + json(body) + "}";
    }

    // ── OAuth2 access token (service-account JWT bearer) ───────────

    private String accessToken() {
        var cached = cachedToken.get();
        // Refresh a minute before expiry to avoid edge-of-validity failures.
        if (cached != null && Instant.now().isBefore(cached.expiresAt().minusSeconds(60))) {
            return cached.value();
        }
        synchronized (cachedToken) {
            var again = cachedToken.get();
            if (again != null && Instant.now().isBefore(again.expiresAt().minusSeconds(60))) {
                return again.value();
            }
            var fresh = fetchAccessToken();
            if (fresh != null) cachedToken.set(fresh);
            return fresh != null ? fresh.value() : null;
        }
    }

    private AccessToken fetchAccessToken() {
        try {
            var acct = account();
            String jwt = buildSignedJwt(acct, Instant.now().getEpochSecond());
            String form = "grant_type=" + URLEncoder.encode(
                    "urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8)
                + "&assertion=" + URLEncoder.encode(jwt, StandardCharsets.UTF_8);
            var request = HttpRequest.newBuilder(URI.create(acct.tokenUri()))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
            var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                LOG.warnf("FCM token endpoint returned %d", response.statusCode());
                return null;
            }
            JsonNode node = MAPPER.readTree(response.body());
            String value = node.path("access_token").asText(null);
            long expiresIn = node.path("expires_in").asLong(3600);
            if (value == null) return null;
            return new AccessToken(value, Instant.now().plusSeconds(expiresIn));
        } catch (Exception e) {
            LOG.warnf(e, "failed to obtain FCM access token");
            return null;
        }
    }

    /** Build and RS256-sign a Google OAuth2 JWT bearer assertion. */
    static String buildSignedJwt(ServiceAccount acct, long nowEpochSec) throws Exception {
        String header = base64Url("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        long exp = nowEpochSec + 3600;
        String claims = base64Url("{\"iss\":" + json(acct.clientEmail())
            + ",\"scope\":" + json(FCM_SCOPE)
            + ",\"aud\":" + json(acct.tokenUri())
            + ",\"iat\":" + nowEpochSec + ",\"exp\":" + exp + "}");
        String signingInput = header + "." + claims;
        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(acct.privateKey());
        signer.update(signingInput.getBytes(StandardCharsets.UTF_8));
        String signature = base64UrlBytes(signer.sign());
        return signingInput + "." + signature;
    }

    // ── Service-account parsing ────────────────────────────────────

    private ServiceAccount account() {
        if (account != null) return account;
        if (accountParseFailed || serviceAccountConfig.isEmpty()
            || serviceAccountConfig.get().isBlank()) {
            return null;
        }
        synchronized (this) {
            if (account != null) return account;
            try {
                account = parseServiceAccount(serviceAccountConfig.get());
            } catch (Exception e) {
                accountParseFailed = true;
                LOG.errorf(e, "invalid Firebase service account — push disabled");
            }
            return account;
        }
    }

    /** Parse a service account from inline JSON, or a path to the JSON file. */
    static ServiceAccount parseServiceAccount(String raw) throws Exception {
        String json = raw.trim().startsWith("{")
            ? raw
            : Files.readString(Path.of(raw.trim()));
        JsonNode node = MAPPER.readTree(json);
        String projectId = node.path("project_id").asText();
        String clientEmail = node.path("client_email").asText();
        String tokenUri = node.path("token_uri").asText("https://oauth2.googleapis.com/token");
        PrivateKey key = loadPrivateKey(node.path("private_key").asText());
        return new ServiceAccount(projectId, clientEmail, key, tokenUri);
    }

    private static PrivateKey loadPrivateKey(String pem) throws Exception {
        String base64 = pem
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    // ── Encoding helpers ──────────────────────────────────────────

    private static String base64Url(String value) {
        return base64UrlBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String base64UrlBytes(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Minimal JSON string escaping for the small notification payload. */
    static String json(String value) {
        if (value == null) return "\"\"";
        var sb = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> sb.append(c);
            }
        }
        return sb.append("\"").toString();
    }
}
