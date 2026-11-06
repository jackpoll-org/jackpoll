package org.acme.service;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.acme.exception.RateLimitedException;
import org.acme.exception.ResourceNotFoundException;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.scheduler.Scheduled;
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

    /** Anonymous writes per survey and client IP per minute; generous enough
     *  for a classroom answering a live quiz behind one NAT address. */
    @ConfigProperty(name = "survey.public-write.rate-limit.max", defaultValue = "600")
    int publicWriteMax;

    private static final Pattern UUID_SHAPE =
        Pattern.compile("^[0-9a-fA-F-]{36}$");

    /** Recent hit timestamps (epoch millis) and the window they count in. */
    private record Window(Deque<Long> times, long windowMs) {}

    /** key → its window, for the in-memory backend. */
    private final Map<String, Window> hits = new ConcurrentHashMap<>();


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

    /** Whether {@code key}'s window is already full, without recording a hit. */
    public boolean exhausted(String key, int max, long windowSeconds) {
        if (max <= 0) return false;
        if ("redis".equalsIgnoreCase(backend) && !redis.isUnsatisfied()) {
            try {
                long bucket = System.currentTimeMillis() / (windowSeconds * 1000L);
                Long count = redis.get().value(Long.class).get("rl:" + key + ":" + bucket);
                return count != null && count >= max;
            } catch (Exception e) {
                LOG.debugf(e, "Redis rate-limit peek failed for %s; falling back", key);
            }
        }
        Window window = hits.get(key);
        if (window == null) return false;
        Deque<Long> deque = window.times();
        long cutoff = System.currentTimeMillis() - windowSeconds * 1000L;
        synchronized (deque) {
            return deque.stream().filter(t -> t >= cutoff).count() >= max;
        }
    }

    /** Record {@code amount} units at once (e.g. megabytes); false once the window's budget is spent. */
    public boolean allowAmount(String key, int amount, int max, long windowSeconds) {
        for (int i = 0; i < amount; i++) {
            if (!allow(key, max, windowSeconds)) return false;
        }
        return true;
    }

    public void requirePublicWrite(String kind, String surveyId, String ip) {
        // Survey ids are UUIDs; anything else would only mint throwaway keys.
        if (surveyId == null || !UUID_SHAPE.matcher(surveyId).matches()) {
            throw new ResourceNotFoundException("Survey not found: " + surveyId);
        }
        if (!allow(kind + "|" + surveyId + "|" + org.acme.resource.ClientIp.bucket(ip), publicWriteMax, 60)) {
            throw new RateLimitedException("Too many requests. Please wait a moment and try again.");
        }
    }

    /** Drop in-memory windows whose last hit is older than their own window, so the map can't grow without bound. */
    @Scheduled(every = "1m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void evictIdle() {
        long now = System.currentTimeMillis();
        for (String key : hits.keySet()) {
            hits.computeIfPresent(key, (k, window) -> {
                synchronized (window.times()) {
                    return window.times().isEmpty() || window.times().peekLast() + window.windowMs() < now
                        ? null : window;
                }
            });
        }
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
        Deque<Long> deque = hits.computeIfAbsent(key, k -> new Window(new ArrayDeque<>(), windowMs)).times();
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
