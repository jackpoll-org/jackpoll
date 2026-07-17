package org.acme.service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.acme.resource.ResultsRelay;
import org.jboss.logging.Logger;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.redis.datasource.RedisDataSource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

/**
 * Presenter-paced live mode (#): the survey owner drives everyone through the
 * questions one at a time. The current position is broadcast to participants
 * over the existing results WebSocket ({@code /results-ws}) as a small JSON
 * control message {@code {"live":{"index":N,"phase":"..."}}}, so no new socket
 * or Traefik route is needed.
 *
 * The broadcast is push-only and best-effort: a participant whose WebSocket
 * silently died (screen lock, flaky mobile network) never gets it. So the last
 * broadcast state is also cached here for participants to poll as a resync
 * fallback ({@link #getState}) — memory-only on a single replica, mirrored to
 * Redis (when available) so a GET landing on a different replica than the one
 * that received the POST still sees it, following {@link RateLimiterService}'s
 * established memory/Redis degrade pattern.
 */
@ApplicationScoped
public class LivePresentService {

    private static final Logger LOG = Logger.getLogger(LivePresentService.class);
    private static final String REDIS_KEY_PREFIX = "live-state:";
    private static final Duration STATE_TTL = Duration.ofHours(6);

    @Inject
    SurveyService surveyService;

    @Inject
    ResultsRelay relay;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    Instance<RedisDataSource> redis;

    /** surveyId → last broadcast state, for the single-replica/dev fallback. */
    private final Map<String, LiveState> lastState = new ConcurrentHashMap<>();

    public record LiveState(int index, String phase) {}

    /** Broadcast the presenter's current question index + phase. Owner only. */
    public void setState(String ownerId, String surveyId, int index, String phase) {
        surveyService.requireOwner(ownerId, surveyId);
        var normalizedIndex = Math.max(0, index);
        var normalizedPhase = phase == null || phase.isBlank() ? "question" : phase;
        var state = new LiveState(normalizedIndex, normalizedPhase);
        lastState.put(surveyId, state);
        writeRedisState(surveyId, state);
        try {
            var msg = objectMapper.writeValueAsString(Map.of(
                "live", Map.of("index", normalizedIndex, "phase", normalizedPhase)));
            relay.broadcast(surveyId, msg);
        } catch (Exception e) {
            // Best-effort: a broadcast failure must not fail the presenter's action.
        }
    }

    /**
     * The last state broadcast for {@code surveyId}, for a participant to poll
     * as a resync fallback when it suspects it missed a push. {@code null} if
     * the presenter hasn't broadcast anything yet (e.g. still in the lobby).
     */
    public LiveState getState(String surveyId) {
        var fromRedis = readRedisState(surveyId);
        if (fromRedis != null) return fromRedis;
        return lastState.get(surveyId);
    }

    private void writeRedisState(String surveyId, LiveState state) {
        if (redis.isUnsatisfied()) return;
        try {
            redis.get().value(String.class)
                .setex(REDIS_KEY_PREFIX + surveyId, STATE_TTL.toSeconds(), encode(state));
        } catch (Exception e) {
            LOG.debugf(e, "Live state: Redis write failed for survey %s; memory-only", surveyId);
        }
    }

    private LiveState readRedisState(String surveyId) {
        if (redis.isUnsatisfied()) return null;
        try {
            var raw = redis.get().value(String.class).get(REDIS_KEY_PREFIX + surveyId);
            return decode(raw);
        } catch (Exception e) {
            LOG.debugf(e, "Live state: Redis read failed for survey %s; falling back", surveyId);
            return null;
        }
    }

    private static String encode(LiveState state) {
        return state.index() + ":" + state.phase();
    }

    private static LiveState decode(String raw) {
        if (raw == null) return null;
        int sep = raw.indexOf(':');
        if (sep < 0) return null;
        try {
            return new LiveState(Integer.parseInt(raw.substring(0, sep)), raw.substring(sep + 1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Broadcast a participant's lobby check-in as {@code {"join":{"name":...}}}
     * so the presenter can list who has joined. Anonymous + best-effort.
     */
    public void announceJoin(String surveyId, String name) {
        if (name == null || name.isBlank()) return;
        var clean = name.trim();
        if (clean.length() > 60) clean = clean.substring(0, 60);
        try {
            var msg = objectMapper.writeValueAsString(Map.of("join", Map.of("name", clean)));
            relay.broadcast(surveyId, msg);
        } catch (Exception e) {
            // Best-effort: a broadcast failure must not fail the participant's join.
        }
    }
}
