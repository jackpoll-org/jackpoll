package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for the Web Push payload builder — no network, no Quarkus.
 * (Delivery uses VAPID/RFC 8291; the same payload reaches browsers and the
 * mobile app via UnifiedPush.)
 */
class PushServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void buildsWebPushPayload() throws Exception {
        JsonNode node = MAPPER.readTree(
            PushService.buildWebPayload("New response", "Survey \"Q1\" got a reply"));
        assertEquals("New response", node.path("title").asText());
        // Quotes in the body are escaped and survive JSON parsing.
        assertEquals("Survey \"Q1\" got a reply", node.path("body").asText());
    }
}
