package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Base64;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for the FCM HTTP v1 helpers (issue #46) — no network, no Quarkus.
 * Generates a throwaway RSA key, parses a service account built from it, and
 * verifies the signed OAuth2 JWT bearer assertion.
 */
class PushServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static String toPem(byte[] pkcs8) {
        String b64 = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(pkcs8);
        return "-----BEGIN PRIVATE KEY-----\n" + b64 + "\n-----END PRIVATE KEY-----\n";
    }

    @Test
    void buildsV1MessagePayload() throws Exception {
        JsonNode node = MAPPER.readTree(
            PushService.buildV1Payload("tok-123", "Hi", "New \"response\""));
        assertEquals("tok-123", node.path("message").path("token").asText());
        assertEquals("Hi", node.path("message").path("notification").path("title").asText());
        // Quotes in the body are escaped and survive JSON parsing.
        assertEquals("New \"response\"",
            node.path("message").path("notification").path("body").asText());
    }

    @Test
    void buildsWebPushPayload() throws Exception {
        JsonNode node = MAPPER.readTree(
            PushService.buildWebPayload("New response", "Survey \"Q1\" got a reply"));
        assertEquals("New response", node.path("title").asText());
        // Quotes in the body are escaped and survive JSON parsing.
        assertEquals("Survey \"Q1\" got a reply", node.path("body").asText());
    }

    @Test
    void parsesServiceAccountAndSignsAVerifiableJwt() throws Exception {
        var gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        KeyPair kp = gen.generateKeyPair();

        String saJson = MAPPER.writeValueAsString(Map.of(
            "project_id", "survey-proj",
            "client_email", "svc@survey-proj.iam.gserviceaccount.com",
            "token_uri", "https://oauth2.googleapis.com/token",
            "private_key", toPem(kp.getPrivate().getEncoded())));

        var account = PushService.parseServiceAccount(saJson);
        assertEquals("survey-proj", account.projectId());
        assertEquals("svc@survey-proj.iam.gserviceaccount.com", account.clientEmail());

        long now = 1_700_000_000L;
        String jwt = PushService.buildSignedJwt(account, now);
        String[] parts = jwt.split("\\.");
        assertEquals(3, parts.length);

        // Signature verifies against the matching public key.
        var verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(kp.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8));
        boolean valid = verifier.verify(Base64.getUrlDecoder().decode(parts[2]));
        assertTrue(valid, "JWT signature should verify");

        // Claims carry the right issuer, audience, scope and a 1-hour expiry.
        JsonNode claims = MAPPER.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertEquals("svc@survey-proj.iam.gserviceaccount.com", claims.path("iss").asText());
        assertEquals("https://oauth2.googleapis.com/token", claims.path("aud").asText());
        assertEquals("https://www.googleapis.com/auth/firebase.messaging",
            claims.path("scope").asText());
        assertEquals(now, claims.path("iat").asLong());
        assertEquals(now + 3600, claims.path("exp").asLong());
    }
}
