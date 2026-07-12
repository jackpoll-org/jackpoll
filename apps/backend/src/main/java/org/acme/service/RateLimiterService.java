package org.acme.service;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.redis.datasource.RedisDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

/**
 * Fixed-window rate limiter with two interchangeable backends (issue #42):
 *
 * <ul>
 *   <li><b>memory</b> — a per-instance sliding window. Correct for a single
 *       node; the default so dev/test need no extra infrastructure.</li>
 *   <li><b>redis</b> — an atomic {@code INCR}+{@code EXPIRE} fixed window
 *       shared across instances, so a horizontally-scaled deployment enforces
 *       one global limit. If Redis is unavailable the call falls back to the
 *       in-memory window (fail-open to availability, never crashes a submit).</li>
 * </ul>
 *
 * Selected via {@code survey.rate-limit.backend}.
 */
@ApplicationScoped
public class RateLimiterService {

    private static final Logger LOG = Logger.getLogger(RateLimiterService.class);

    @ConfigProperty(name = "survey.rate-limit.backend", defaultValue = "memory")
    String backend;

    @Inject
    Instance<RedisDataSource> redis;

    /** key → recent hit timestamps (epoch millis), for the in-memory backend. */
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /**
     * Record one hit for {@code key} and report whether it is within the limit.
     *
     * @return true if allowed, false if the window is already full.
     */
    public boolean allow(String key, int max, long windowSeconds) {
        if (max <= 0) return true;
        if ("redis".equalsIgnoreCase(backend)) {
            Boolean allowed = tryRedis(key, max, windowSeconds);
            if (allowed != null) return allowed;
            // Redis unreachable → degrade to the local window rather than failing.
        }
        return allowInMemory(key, max, windowSeconds);
    }

    // ── Redis fixed-window ────────────────────────────────────────

    private Boolean tryRedis(String key, int max, long windowSeconds) {
        if (redis.isUnsatisfied()) return null;
        try {
            var ds = redis.get();
            long bucket = System.currentTimeMillis() / (windowSeconds * 1000L);
            String redisKey = "rl:" + key + ":" + bucket;
            var counts = ds.value(Long.class);
            long count = counts.incr(redisKey);
            if (count == 1L) {
                // First hit in this window — set the TTL so the key self-cleans.
                ds.key().expire(redisKey, Duration.ofSeconds(windowSeconds + 1));
            }
            return count <= max;
        } catch (Exception e) {
            LOG.debugf(e, "Redis rate-limit check failed for %s; falling back", key);
            return null;
        }
    }

    // ── In-memory sliding window ──────────────────────────────────

    private boolean allowInMemory(String key, int max, long windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;
        Deque<Long> deque = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && now - deque.peekFirst() > windowMs) {
                deque.pollFirst();
            }
            if (deque.size() >= max) return false;
            deque.addLast(now);
            return true;
        }
    }
}
