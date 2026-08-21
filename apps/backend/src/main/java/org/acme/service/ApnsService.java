package org.acme.service;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Apple Push Notification service (APNs) delivery for the iOS app.
 *
 * <p>iOS cannot use the Web Push channel the rest of the app relies on: a
 * WKWebView has no Push API, so the native app registers with APNs and hands
 * its device token to {@code POST /me/devices} with platform {@code "ios"}.
 * {@link PushService} routes those devices here.
 *
 * <p>Auth is token-based (JWT, ES256) with an APNs key ({@code .p8}) from the
 * developer portal — no certificates to renew. Everything is env-gated
 * ({@code survey.push.apns.*}); without a key this is a no-op, exactly like the
 * VAPID gate on Web Push.
 */
@ApplicationScoped
public class ApnsService {

    private static final Logger LOG = Logger.getLogger(ApnsService.class);

    private static final String HOST_PRODUCTION = "https://api.push.apple.com";
    private static final String HOST_SANDBOX = "https://api.sandbox.push.apple.com";

    /** Apple rejects tokens older than 1 h; refresh well before that. */
    private static final Duration TOKEN_TTL = Duration.ofMinutes(45);

    /** The APNs key id (10 chars) shown next to the key in the portal. */
    @ConfigProperty(name = "survey.push.apns.key-id")
    Optional<String> keyId;

    /** The Apple developer team id that owns the key. */
    @ConfigProperty(name = "survey.push.apns.team-id")
    Optional<String> teamId;

    /** Contents of the {@code AuthKey_XXXXXXXXXX.p8} — PEM or bare base64. */
    @ConfigProperty(name = "survey.push.apns.private-key")
    Optional<String> privateKeyPem;

    /** The app's bundle id — APNs calls this the topic. */
    @ConfigProperty(name = "survey.push.apns.topic", defaultValue = "de.quavon.jackpoll")
    String topic;

    /**
     * Production APNs by default. TestFlight and App Store builds ship the
     * {@code aps-environment: production} entitlement and MUST use it; only
     * locally built debug apps talk to the sandbox.
     */
    @ConfigProperty(name = "survey.push.apns.production", defaultValue = "true")
    boolean production;

    enum ApnsResult { OK, INVALID_TOKEN, ERROR }

    private final HttpClient http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_2)
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    private volatile String cachedJwt;
    private volatile Instant cachedJwtAt;
    private volatile PrivateKey signingKey;
    private volatile boolean keyInitFailed;

    /** True once a key id, team id and private key are configured. */
    public boolean isConfigured() {
        return present(keyId) && present(teamId) && present(privateKeyPem) && signingKey() != null;
    }

    private static boolean present(Optional<String> value) {
        return value.isPresent() && !value.get().isBlank();
    }

    /**
     * Deliver one alert to a device token. Best-effort: any transport problem is
     * an {@link ApnsResult#ERROR}, while Apple telling us the token is dead
     * yields {@link ApnsResult#INVALID_TOKEN} so the caller can prune it.
     */
    public ApnsResult send(String deviceToken, String title, String body) {
        if (!isConfigured()) return ApnsResult.ERROR;
        try {
            var request = HttpRequest.newBuilder()
                .uri(URI.create((production ? HOST_PRODUCTION : HOST_SANDBOX)
                    + "/3/device/" + deviceToken))
                .timeout(Duration.ofSeconds(15))
                .header("authorization", "bearer " + jwt())
                .header("apns-topic", topic)
                .header("apns-push-type", "alert")
                .header("apns-priority", "10")
                .POST(HttpRequest.BodyPublishers.ofString(
                    buildPayload(title, body), StandardCharsets.UTF_8))
                .build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            return classify(response.statusCode(), response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ApnsResult.ERROR;
        } catch (Exception e) {
            LOG.debugf(e, "APNs send failed for one device");
            return ApnsResult.ERROR;
        }
    }

    /**
     * 410 means the app was uninstalled; 400 {@code BadDeviceToken} means the
     * token belongs to the other APNs environment or is malformed. Both are
     * permanent for this token, so the device row can go.
     */
    static ApnsResult classify(int status, String body) {
        if (status >= 200 && status < 300) return ApnsResult.OK;
        if (status == 410) return ApnsResult.INVALID_TOKEN;
        if (status == 400 && body != null
            && (body.contains("BadDeviceToken") || body.contains("DeviceTokenNotForTopic"))) {
            return ApnsResult.INVALID_TOKEN;
        }
        LOG.debugf("APNs returned %d: %s", status, body);
        return ApnsResult.ERROR;
    }

    /** The alert payload iOS renders while the app is backgrounded. */
    static String buildPayload(String title, String body) {
        return "{\"aps\":{\"alert\":{\"title\":" + PushService.json(title)
            + ",\"body\":" + PushService.json(body)
            + "},\"sound\":\"default\"}}";
    }

    // ── Provider token (JWT, ES256) ───────────────────────────────

    /** A cached provider token; Apple rate-limits regenerating them. */
    private String jwt() throws Exception {
        var token = cachedJwt;
        var issuedAt = cachedJwtAt;
        if (token != null && issuedAt != null
            && Instant.now().isBefore(issuedAt.plus(TOKEN_TTL))) {
            return token;
        }
        synchronized (this) {
            if (cachedJwt != null && cachedJwtAt != null
                && Instant.now().isBefore(cachedJwtAt.plus(TOKEN_TTL))) {
                return cachedJwt;
            }
            var now = Instant.now();
            var header = "{\"alg\":\"ES256\",\"kid\":\"" + keyId.orElseThrow().strip() + "\"}";
            var claims = "{\"iss\":\"" + teamId.orElseThrow().strip()
                + "\",\"iat\":" + now.getEpochSecond() + "}";
            var signingInput = base64Url(header.getBytes(StandardCharsets.UTF_8))
                + "." + base64Url(claims.getBytes(StandardCharsets.UTF_8));

            var signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(signingKey());
            signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            var jose = derToJose(signer.sign());

            cachedJwt = signingInput + "." + base64Url(jose);
            cachedJwtAt = now;
            return cachedJwt;
        }
    }

    /** Parse the {@code .p8} once. Accepts PEM with or without the header. */
    private PrivateKey signingKey() {
        if (signingKey != null) return signingKey;
        if (keyInitFailed || !present(privateKeyPem)) return null;
        synchronized (this) {
            if (signingKey != null) return signingKey;
            if (keyInitFailed) return null;
            try {
                var der = Base64.getDecoder().decode(stripPem(privateKeyPem.get()));
                signingKey = KeyFactory.getInstance("EC")
                    .generatePrivate(new PKCS8EncodedKeySpec(der));
                return signingKey;
            } catch (Exception e) {
                LOG.warnf(e, "failed to read the APNs signing key (bad .p8?)");
                keyInitFailed = true;
                return null;
            }
        }
    }

    /** Strip PEM armour and all whitespace, leaving pure base64. */
    static String stripPem(String pem) {
        return pem.replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
    }

    static String base64Url(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * {@code Signature} emits an ASN.1 DER {@code SEQUENCE { r, s }}, but JOSE
     * wants the two integers left-padded to 32 bytes and concatenated.
     */
    static byte[] derToJose(byte[] der) {
        if (der.length < 8 || der[0] != 0x30) {
            throw new IllegalArgumentException("not a DER ECDSA signature");
        }
        int offset = der[1] == 0x81 ? 3 : 2; // long-form length for >127 bytes
        if (der[offset] != 0x02) throw new IllegalArgumentException("missing r");
        int rLength = der[offset + 1];
        var r = new BigInteger(1, der, offset + 2, rLength);
        int sMarker = offset + 2 + rLength;
        if (der[sMarker] != 0x02) throw new IllegalArgumentException("missing s");
        int sLength = der[sMarker + 1];
        var s = new BigInteger(1, der, sMarker + 2, sLength);

        var jose = new byte[64];
        copyRightAligned(r, jose, 0);
        copyRightAligned(s, jose, 32);
        return jose;
    }

    /** Write a positive 256-bit integer into a 32-byte slot, left-padded. */
    private static void copyRightAligned(BigInteger value, byte[] target, int slotStart) {
        var bytes = value.toByteArray();
        // BigInteger may prepend a zero sign byte, or be shorter than 32 bytes.
        int from = Math.max(0, bytes.length - 32);
        int length = bytes.length - from;
        System.arraycopy(bytes, from, target, slotStart + 32 - length, length);
    }
}
