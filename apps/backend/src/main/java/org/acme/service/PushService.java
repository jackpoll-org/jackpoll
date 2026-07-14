package org.acme.service;

import java.security.Security;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.acme.entity.DeviceToken;
import org.acme.repository.DeviceTokenRepository;
import org.acme.repository.UserRepository;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Push notifications to a user's registered devices via <b>Web Push</b>
 * (VAPID, RFC 8291/8292). This is the single delivery channel for both browsers
 * and the mobile app: on Android the app registers through <b>UnifiedPush</b>,
 * whose distributor hands the app a Web Push endpoint + keys — indistinguishable
 * from a browser subscription, so the same code delivers to both.
 *
 * <p>Sending is env-gated by the VAPID key pair ({@code survey.push.vapid.*}):
 * without keys it is a no-op, so dev/test need no configuration. Registration
 * always works; delivery is best-effort and off the request thread. Endpoints
 * the push service reports as gone (404/410) — including legacy FCM tokens that
 * carry no encryption keys — are pruned.
 */
@ApplicationScoped
public class PushService {

    private static final Logger LOG = Logger.getLogger(PushService.class);

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

    private static final ExecutorService PUSH_EXECUTOR =
        Executors.newSingleThreadExecutor(r -> {
            var t = new Thread(r, "push-dispatch");
            t.setDaemon(true);
            return t;
        });

    /** Web Push client, built lazily from the VAPID keys (#74). */
    private volatile nl.martijndwars.webpush.PushService webPush;
    private volatile boolean webPushInitFailed;

    private enum SendResult { OK, INVALID_TOKEN, ERROR }

    /** Web Push is usable once a VAPID key pair is configured. */
    private boolean webConfigured() {
        return webPushClient() != null;
    }

    // ── Registration ──────────────────────────────────────────────

    /** Register (or re-assign) a device without encryption keys (legacy). */
    @Transactional
    public void register(String userId, String token, String platform) {
        register(userId, token, platform, null, null);
    }

    /**
     * Register (or re-assign) a device to a user. Web Push / UnifiedPush
     * subscriptions carry the {@code p256dh}/{@code auth} encryption keys.
     * The {@code token} column stores the push endpoint URL.
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

    /** Remove a device (e.g. on logout / unregister). */
    @Transactional
    public void unregister(String userId, String token) {
        devices.findByToken(token)
            .filter(d -> d.userId.equals(userId))
            .ifPresent(devices::delete);
    }

    // ── Sending ───────────────────────────────────────────────────

    /** Immutable snapshot of a device, read inside the caller's transaction. */
    private record Target(String token, String platform, String p256dh, String auth) {
        boolean isWebChannel() { return "web".equals(platform); }
        boolean deliverable() { return p256dh != null && auth != null; }
    }

    /**
     * Best-effort Web Push to every registered device of {@code userId}. Reads
     * the devices in the caller's transaction, then sends off-thread. Respects
     * the owner's per-channel preferences ("web" endpoints = web channel, all
     * others = mobile channel). No-op when Web Push isn't configured.
     */
    public void notifyUser(String userId, String title, String body) {
        deliver(userId, title, body);
    }

    /**
     * Send a message and return how many deliverable endpoints it targeted (for
     * the debug "test push" endpoint). 0 means the user has no usable device.
     */
    public int sendTest(String userId, String title, String body) {
        return deliver(userId, title, body);
    }

    /** How many of the user's devices can actually receive Web Push. */
    public long deliverableDeviceCount(String userId) {
        return devices.findByUser(userId).stream()
            .filter(d -> d.p256dh != null && d.auth != null)
            .count();
    }

    private int deliver(String userId, String title, String body) {
        if (!webConfigured()) return 0;
        var prefs = users.findByIdOptional(userId).orElse(null);
        final boolean wantMobile = prefs == null || prefs.notifyNewResponseMobile;
        final boolean wantWeb = prefs == null || prefs.notifyNewResponseWeb;
        if (!wantMobile && !wantWeb) return 0;
        List<Target> targets = devices.findByUser(userId).stream()
            .map(d -> new Target(d.token, d.platform, d.p256dh, d.auth))
            .filter(t -> t.isWebChannel() ? wantWeb : wantMobile)
            .toList();
        if (targets.isEmpty()) return 0;
        int deliverable = (int) targets.stream().filter(Target::deliverable).count();
        PUSH_EXECUTOR.execute(() -> {
            for (var target : targets) {
                SendResult result = sendWebPush(target, title, body);
                if (result == SendResult.INVALID_TOKEN) {
                    pruneToken(target.token());
                }
            }
        });
        return deliverable;
    }

    private void pruneToken(String token) {
        try {
            QuarkusTransaction.requiringNew().run(() ->
                devices.findByToken(token).ifPresent(devices::delete));
        } catch (Exception e) {
            LOG.debugf(e, "could not prune stale endpoint");
        }
    }

    // ── Web Push (VAPID, RFC 8291) ─────────────────────────────────

    /** The configured VAPID public key for clients to subscribe with (#74). */
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
        // A subscription without its encryption keys can never be delivered
        // (this is also how legacy FCM tokens get pruned after the update).
        if (!target.deliverable()) return SendResult.INVALID_TOKEN;
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

    /** Payload read by the service worker's / receiver's push handler. */
    static String buildWebPayload(String title, String body) {
        return "{\"title\":" + json(title) + ",\"body\":" + json(body) + "}";
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
