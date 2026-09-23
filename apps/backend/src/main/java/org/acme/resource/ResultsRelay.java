package org.acme.resource;

import io.quarkus.redis.datasource.ReactiveRedisDataSource;
import io.quarkus.redis.datasource.pubsub.ReactivePubSubCommands;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Live-results fan-out (wordcloud / live presentation / live quiz). When a
 * response is submitted, a tiny text ping is broadcast to every viewer watching
 * that survey's results so they refetch the aggregated counts in near-real-time.
 *
 * Mirrors {@link CollabRelay}: local peers are served directly; across backend
 * replicas a Redis pub/sub channel relays the message so viewers on a different
 * replica still update. When Redis is absent (dev), it degrades to a
 * single-replica local relay. Viewers only listen — there is no inbound message
 * handling.
 *
 * Built to survive a big live quiz, where every player answers within seconds:
 * <ul>
 *   <li>Bare {@value #PING} pings carry no data, so a burst of them is coalesced
 *       into one per survey per {@code pingIntervalMs}. Without this, N players
 *       answering cost N x N socket frames per question (1M at 1000 players).</li>
 *   <li>Every send runs on the relay's own thread, never the caller's. Callers
 *       sit inside JTA transactions, and Mutiny subscriptions made there carry
 *       the transaction onto I/O threads — the commit then fails with
 *       "committing with 2 threads active" and the answer is lost.</li>
 *   <li>Host-only messages (lobby check-ins) reach only sockets that connected
 *       with {@code ?role=host}, instead of every player's phone.</li>
 * </ul>
 */
@ApplicationScoped
public class ResultsRelay {

    /** The data-free "results changed, refetch" message; safe to coalesce. */
    public static final String PING = "updated";

    private static final Logger LOG = Logger.getLogger(ResultsRelay.class);
    private static final String CHANNEL_PREFIX = "results:";
    // Prefix Redis publishes with this replica's tag so we ignore our own echoes.
    private static final String SELF_TAG = UUID.randomUUID().toString();
    private static final String SEP = " ";
    private static final String TARGET_ALL = "all";
    private static final String TARGET_HOSTS = "hosts";
    private static final Duration RETRY_MIN = Duration.ofSeconds(1);
    private static final Duration RETRY_MAX = Duration.ofSeconds(10);
    private static final int RETRY_ATTEMPTS = 3;

    /** Every viewer per survey (hosts included). */
    private final Map<String, Set<WebSocketConnection>> rooms = new ConcurrentHashMap<>();
    /** The subset of viewers that connected as the presenter ({@code ?role=host}). */
    private final Map<String, Set<WebSocketConnection>> hostRooms = new ConcurrentHashMap<>();
    /** Surveys with a ping waiting for the next flush. */
    private final Set<String> pendingPings = ConcurrentHashMap.newKeySet();

    @Inject
    Instance<ReactiveRedisDataSource> redis;

    @ConfigProperty(name = "survey.results.ping-interval-ms", defaultValue = "500")
    long pingIntervalMs;

    private ScheduledExecutorService sender;

    private volatile ReactivePubSubCommands<String> publisher;
    // Kept referenced so the dedicated subscriber connection is not GC'd — losing
    // it silently stops cross-replica fan-out.
    private volatile ReactivePubSubCommands<String> subscriberCommands;
    private volatile ReactivePubSubCommands.ReactiveRedisSubscriber subscription;

    @PostConstruct
    void init() {
        // A plain executor: unlike a managed one it propagates no context, so no
        // caller's transaction can follow a send onto another thread.
        sender = Executors.newSingleThreadScheduledExecutor(r -> {
            var thread = new Thread(r, "results-relay");
            thread.setDaemon(true);
            return thread;
        });
        sender.scheduleWithFixedDelay(
            this::flushPings, pingIntervalMs, pingIntervalMs, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    void shutdown() {
        sender.shutdownNow();
    }

    /**
     * Subscribe at startup, on the main thread, using the reactive Redis API —
     * see {@link CollabRelay#onStart} for why the blocking API on a lazily
     * created bean timed out here.
     */
    void onStart(@Observes StartupEvent event) {
        if (redis.isUnsatisfied()) {
            LOG.warn("Results relay: Redis unavailable — single-replica fan-out only");
            return;
        }
        var ds = redis.get();
        publisher = ds.pubsub(String.class);
        var commands = ds.pubsub(String.class);
        subscriberCommands = commands;
        commands.subscribeToPattern(CHANNEL_PREFIX + "*", this::onRedis)
            .onFailure().retry().withBackOff(RETRY_MIN, RETRY_MAX).atMost(RETRY_ATTEMPTS)
            .subscribe().with(
                subscriber -> {
                    subscription = subscriber;
                    LOG.info("Results relay: Redis cross-replica pub/sub active");
                },
                failure -> {
                    // Publishing still works without a subscription, so keep it:
                    // the other replicas can see us even when we cannot see them.
                    subscriberCommands = null;
                    LOG.error("Results relay: Redis subscribe failed — inbound cross-replica"
                        + " pings will be missed", failure);
                });
    }

    void onStop(@Observes ShutdownEvent event) {
        var subscriber = subscription;
        if (subscriber == null) return;
        subscription = null;
        try {
            subscriber.unsubscribe().await().atMost(RETRY_MIN);
        } catch (Exception e) {
            LOG.debugf(e, "Results relay: unsubscribe on shutdown failed");
        }
    }

    void register(String room, WebSocketConnection conn, boolean host) {
        rooms.computeIfAbsent(room, k -> ConcurrentHashMap.newKeySet()).add(conn);
        if (host) {
            hostRooms.computeIfAbsent(room, k -> ConcurrentHashMap.newKeySet()).add(conn);
        }
    }

    void unregister(String room, WebSocketConnection conn) {
        remove(rooms, room, conn);
        remove(hostRooms, room, conn);
    }

    private static void remove(
        Map<String, Set<WebSocketConnection>> index, String room, WebSocketConnection conn) {
        var peers = index.get(room);
        if (peers != null) {
            peers.remove(conn);
            if (peers.isEmpty()) index.remove(room);
        }
    }

    /**
     * Notify everyone watching {@code surveyId}'s results. A bare {@value #PING}
     * is coalesced into the next flush; anything else (live state, wordcloud
     * deltas) is sent right away. Best-effort: never throws, so a relay failure
     * cannot fail a response submission.
     */
    public void broadcast(String surveyId, String message) {
        if (PING.equals(message)) {
            pendingPings.add(surveyId);
            return;
        }
        enqueue(surveyId, TARGET_ALL, message);
    }

    /** Send to the presenter's sockets only (e.g. lobby check-ins). Best-effort. */
    public void broadcastToHosts(String surveyId, String message) {
        enqueue(surveyId, TARGET_HOSTS, message);
    }

    /** Deliver one ping per survey that had any since the last flush. */
    void flushPings() {
        for (var surveyId : pendingPings) {
            pendingPings.remove(surveyId);
            enqueue(surveyId, TARGET_ALL, PING);
        }
    }

    private void enqueue(String surveyId, String target, String message) {
        try {
            sender.execute(() -> deliver(surveyId, target, message));
        } catch (Exception e) {
            LOG.warnf(e, "Results relay: broadcast failed for survey %s", surveyId);
        }
    }

    private void deliver(String surveyId, String target, String message) {
        try {
            sendLocal(surveyId, target, message);
            var pub = publisher;
            if (pub != null) {
                pub.publish(CHANNEL_PREFIX + surveyId, SELF_TAG + SEP + target + SEP + message)
                    .subscribe().with(
                        ignored -> {},
                        failure -> LOG.warnf(failure,
                            "Results relay: cross-replica publish failed for survey %s", surveyId));
            }
        } catch (Exception e) {
            LOG.warnf(e, "Results relay: broadcast failed for survey %s", surveyId);
        }
    }

    /** A framed message arrived from another replica via Redis. */
    private void onRedis(String channel, String framed) {
        if (framed == null) return;
        int sep = framed.indexOf(SEP);
        if (sep < 0) return;
        var tag = framed.substring(0, sep);
        if (SELF_TAG.equals(tag)) return; // already delivered to local peers
        var room = channel.substring(CHANNEL_PREFIX.length());
        var rest = framed.substring(sep + SEP.length());
        int targetSep = rest.indexOf(SEP);
        var target = targetSep < 0 ? "" : rest.substring(0, targetSep);
        if (TARGET_ALL.equals(target) || TARGET_HOSTS.equals(target)) {
            sendLocal(room, target, rest.substring(targetSep + SEP.length()));
        } else {
            // Untargeted frame from a replica still on the previous release.
            sendLocal(room, TARGET_ALL, rest);
        }
    }

    private void sendLocal(String room, String target, String message) {
        var peers = (TARGET_HOSTS.equals(target) ? hostRooms : rooms).get(room);
        if (peers == null) return;
        for (var peer : peers) {
            if (peer.isOpen()) {
                peer.sendText(message).subscribe().with(ignored -> {}, failure -> {});
            }
        }
    }
}
