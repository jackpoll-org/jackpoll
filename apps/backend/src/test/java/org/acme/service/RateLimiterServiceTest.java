package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

/**
 * In-memory backend of the rate limiter (issue #42). The redis backend is
 * exercised only when configured; here the default "memory" backend applies.
 */
@QuarkusTest
class RateLimiterServiceTest {

    @Inject
    RateLimiterService limiter;

    @Test
    void allowsUpToMaxThenBlocks() {
        String key = "survey-a|1.2.3.4";
        assertTrue(limiter.allow(key, 3, 60));
        assertTrue(limiter.allow(key, 3, 60));
        assertTrue(limiter.allow(key, 3, 60));
        assertFalse(limiter.allow(key, 3, 60), "4th hit exceeds the limit");
    }

    @Test
    void differentKeysHaveIndependentWindows() {
        assertTrue(limiter.allow("survey-b|a", 1, 60));
        assertFalse(limiter.allow("survey-b|a", 1, 60));
        // A different IP/survey is tracked separately.
        assertTrue(limiter.allow("survey-b|b", 1, 60));
    }

    @Test
    void zeroMaxIsUnlimited() {
        assertTrue(limiter.allow("survey-c|x", 0, 60));
        assertTrue(limiter.allow("survey-c|x", 0, 60));
    }

    @Test
    void shortWindowExpiresOldHits() throws InterruptedException {
        String key = "survey-d|x";
        assertTrue(limiter.allow(key, 1, 1));
        assertFalse(limiter.allow(key, 1, 1));
        Thread.sleep(1100);
        assertTrue(limiter.allow(key, 1, 1), "window elapsed → allowed again");
    }
}
