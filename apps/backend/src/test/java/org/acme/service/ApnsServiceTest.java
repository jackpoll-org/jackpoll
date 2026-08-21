package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import org.acme.service.ApnsService.ApnsResult;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for the parts of the APNs client that are easy to get wrong and
 * impossible to notice at runtime: the DER→JOSE signature conversion (a wrong
 * one only shows up as 403 InvalidProviderToken), the response classification
 * that decides whether a device row survives, and the .p8 parsing.
 */
class ApnsServiceTest {

    // ── derToJose ─────────────────────────────────────────────────

    @Test
    void convertsRealEcdsaSignatureToFixed64Bytes() throws Exception {
        var generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        var keyPair = generator.generateKeyPair();

        // Many signatures: r/s length varies, which is exactly the trap.
        for (int i = 0; i < 50; i++) {
            var signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(keyPair.getPrivate());
            signer.update(("message-" + i).getBytes(StandardCharsets.UTF_8));
            var jose = ApnsService.derToJose(signer.sign());

            assertEquals(64, jose.length, "JOSE signatures are always 64 bytes");
            // Both halves must be verifiable as the original integers.
            var r = new BigInteger(1, jose, 0, 32);
            var s = new BigInteger(1, jose, 32, 32);
            assertTrue(r.signum() > 0 && s.signum() > 0);
        }
    }

    @Test
    void padsShortIntegersOnTheLeft() {
        // DER SEQUENCE { INTEGER 0x01, INTEGER 0x02 } — one byte each.
        var der = new byte[] {0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02};
        var jose = ApnsService.derToJose(der);

        var expected = new byte[64];
        expected[31] = 0x01;
        expected[63] = 0x02;
        assertArrayEquals(expected, jose);
    }

    @Test
    void rejectsNonDerInput() {
        assertThrows(IllegalArgumentException.class,
            () -> ApnsService.derToJose(new byte[] {0x01, 0x02, 0x03}));
    }

    // ── classify ──────────────────────────────────────────────────

    @Test
    void treatsSuccessAsOk() {
        assertEquals(ApnsResult.OK, ApnsService.classify(200, ""));
    }

    @Test
    void prunesUninstalledAndBadTokens() {
        assertEquals(ApnsResult.INVALID_TOKEN, ApnsService.classify(410, "{\"reason\":\"Unregistered\"}"));
        assertEquals(ApnsResult.INVALID_TOKEN, ApnsService.classify(400, "{\"reason\":\"BadDeviceToken\"}"));
        assertEquals(ApnsResult.INVALID_TOKEN,
            ApnsService.classify(400, "{\"reason\":\"DeviceTokenNotForTopic\"}"));
    }

    @Test
    void keepsDeviceOnTransientOrConfigErrors() {
        // A bad provider token or an APNs outage must not delete the device.
        assertEquals(ApnsResult.ERROR, ApnsService.classify(403, "{\"reason\":\"InvalidProviderToken\"}"));
        assertEquals(ApnsResult.ERROR, ApnsService.classify(429, "{\"reason\":\"TooManyRequests\"}"));
        assertEquals(ApnsResult.ERROR, ApnsService.classify(503, ""));
        assertEquals(ApnsResult.ERROR, ApnsService.classify(400, "{\"reason\":\"PayloadTooLarge\"}"));
    }

    // ── payload + key parsing ─────────────────────────────────────

    @Test
    void buildsAlertPayloadAndEscapesText() {
        assertEquals(
            "{\"aps\":{\"alert\":{\"title\":\"New response\",\"body\":\"Say \\\"hi\\\"\"},\"sound\":\"default\"}}",
            ApnsService.buildPayload("New response", "Say \"hi\""));
    }

    @Test
    void stripsPemArmourAndWhitespace() {
        var pem = "-----BEGIN PRIVATE KEY-----\nAQID\nBAUG\n-----END PRIVATE KEY-----\n";
        assertEquals("AQIDBAUG", ApnsService.stripPem(pem));
        assertArrayEquals(new byte[] {1, 2, 3, 4, 5, 6},
            Base64.getDecoder().decode(ApnsService.stripPem(pem)));
        // Bare base64 (how it usually arrives through an env var) is unchanged.
        assertEquals("AQIDBAUG", ApnsService.stripPem("AQIDBAUG"));
    }

    @Test
    void isNotConfiguredWithoutCredentials() {
        var service = new ApnsService();
        service.keyId = java.util.Optional.empty();
        service.teamId = java.util.Optional.empty();
        service.privateKeyPem = java.util.Optional.empty();
        assertFalse(service.isConfigured());
        // …and sending is a no-op rather than an exception.
        assertEquals(ApnsResult.ERROR, service.send("token", "t", "b"));
    }
}
