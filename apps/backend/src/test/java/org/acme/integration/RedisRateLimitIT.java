package org.acme.integration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Map;
import java.util.UUID;

import org.acme.service.RateLimiterService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;

/**
 * Real-service check of the Redis rate-limit backend (issue #42). Runs only
 * when a Redis server is reachable on localhost:6379 (e.g. docker compose up
 * redis); otherwise it is skipped, so CI without Redis stays green.
 */
@QuarkusTest
@TestProfile(RedisRateLimitIT.RedisProfile.class)
class RedisRateLimitIT {

    public static class RedisProfile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of(
                "survey.rate-limit.backend", "redis",
                "quarkus.redis.hosts", "redis://localhost:6379");
        }
    }

    @Inject
    RateLimiterService limiter;

    @Inject
    RedisDataSource redis;

    @BeforeEach
    void requireRedis() {
        Assumptions.assumeTrue(reachable("localhost", 6379),
            "Redis not reachable on localhost:6379 — skipping");
    }

    @Test
    void enforcesLimitAndStoresCounterInRedis() {
        String key = "it-survey|" + UUID.randomUUID();

        assertTrue(limiter.allow(key, 2, 60));
        assertTrue(limiter.allow(key, 2, 60));
        assertFalse(limiter.allow(key, 2, 60), "3rd hit exceeds the limit");

        // Prove the counter actually lives in Redis (not the in-memory fallback).
        var keys = redis.key().keys("rl:" + key + ":*");
        assertFalse(keys.isEmpty(), "expected a rate-limit counter key in Redis");
    }

    private static boolean reachable(String host, int port) {
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), 1000);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
