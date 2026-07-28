package org.acme.resource;

import io.quarkus.redis.datasource.ReactiveRedisDataSource;
import io.quarkus.redis.datasource.pubsub.ReactivePubSubCommands;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.websockets.next.WebSocketConnection;
import io.vertx.core.buffer.Buffer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import org.jboss.logging.Logger;

import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Live co-editing fan-out (issue #85). Forwards Yjs sync/awareness binary
 * messages between editors of the same survey. Local peers are served directly;
 * across backend replicas, Redis pub/sub relays the message so editors on
 * different replicas still sync. When Redis is absent (dev), it degrades to a
 * single-replica local relay.
 */
@ApplicationScoped
public class CollabRelay {

    private static final Logger LOG = Logger.getLogger(CollabRelay.class);
    private static final String CHANNEL_PREFIX = "collab:";
    private static final int TAG_LEN = 16;
    private static final Duration RETRY_MIN = Duration.ofSeconds(1);
    private static final Duration RETRY_MAX = Duration.ofSeconds(10);
    private static final int RETRY_ATTEMPTS = 3;

    private final Map<String, Set<WebSocketConnection>> rooms = new ConcurrentHashMap<>();
    private final byte[] selfTag = uuidBytes(UUID.randomUUID());

    @Inject
    Instance<ReactiveRedisDataSource> redis;

    // Dedicated connection for publishing (a connection in subscribe mode can't
    // PUBLISH, so publishing and subscribing must not share one).
    private volatile ReactivePubSubCommands<byte[]> publisher;
    // The active pattern subscription. MUST be kept referenced: the returned
    // subscriber owns the dedicated subscriber connection, so if it is
    // garbage-collected the subscription dies and cross-replica fan-out silently
    // stops — which left editors on different replicas unable to see each other.
    private volatile ReactivePubSubCommands<byte[]> subscriberCommands;
    private volatile ReactivePubSubCommands.ReactiveRedisSubscriber subscription;

    /**
     * Subscribe at startup, on the main thread, using the reactive Redis API.
     *
     * Both parts matter. Lazily initialising from the first WebSocket open ran
     * this on a Vert.x worker thread with a Vert.x context attached, and the
     * blocking pub/sub API awaits the PSUBSCRIBE reply on that context — the
     * reply then had no handler waiting for it and the await died with a
     * TimeoutException, leaving cross-replica fan-out permanently off. The
     * reactive API never blocks a Vert.x context, and starting eagerly means the
     * subscription is live before the first editor connects.
     */
    void onStart(@Observes StartupEvent event) {
        if (redis.isUnsatisfied()) {
            LOG.warn("Collab relay: Redis unavailable — single-replica fan-out only");
            return;
        }
        var ds = redis.get();
        publisher = ds.pubsub(byte[].class);
        var commands = ds.pubsub(byte[].class);
        subscriberCommands = commands;
        commands.subscribeToPattern(CHANNEL_PREFIX + "*", this::onRedis)
            .onFailure().retry().withBackOff(RETRY_MIN, RETRY_MAX).atMost(RETRY_ATTEMPTS)
            .subscribe().with(
                subscriber -> {
                    subscription = subscriber;
                    LOG.info("Collab relay: Redis cross-replica pub/sub active");
                },
                failure -> {
                    // Publishing still works without a subscription, so keep it:
                    // the other replicas can see us even when we cannot see them.
                    subscriberCommands = null;
                    LOG.error("Collab relay: Redis subscribe failed — inbound cross-replica"
                        + " messages will be missed", failure);
                });
    }

    void onStop(@Observes ShutdownEvent event) {
        var subscriber = subscription;
        if (subscriber == null) return;
        subscription = null;
        try {
            subscriber.unsubscribe().await().atMost(RETRY_MIN);
        } catch (Exception e) {
            LOG.debugf(e, "Collab relay: unsubscribe on shutdown failed");
        }
    }

    void register(String room, WebSocketConnection conn) {
        rooms.computeIfAbsent(room, k -> ConcurrentHashMap.newKeySet()).add(conn);
    }

    void unregister(String room, WebSocketConnection conn) {
        var peers = rooms.get(room);
        if (peers != null) {
            peers.remove(conn);
            if (peers.isEmpty()) rooms.remove(room);
        }
    }

    /** A binary message arrived from a local client. */
    void onClientMessage(String room, WebSocketConnection from, byte[] data) {
        sendLocal(room, from, data);
        var pub = publisher;
        if (pub != null) {
            var framed = new byte[TAG_LEN + data.length];
            System.arraycopy(selfTag, 0, framed, 0, TAG_LEN);
            System.arraycopy(data, 0, framed, TAG_LEN, data.length);
            pub.publish(CHANNEL_PREFIX + room, framed)
                .subscribe().with(
                    ignored -> {},
                    failure -> LOG.warnf(failure,
                        "Collab relay: cross-replica publish failed for room %s", room));
        }
    }

    /** A framed message arrived from another replica via Redis. */
    private void onRedis(String channel, byte[] framed) {
        if (framed == null || framed.length < TAG_LEN) return;
        // Ignore our own publishes (already delivered to local peers).
        if (Arrays.equals(framed, 0, TAG_LEN, selfTag, 0, TAG_LEN)) return;
        var room = channel.substring(CHANNEL_PREFIX.length());
        var data = Arrays.copyOfRange(framed, TAG_LEN, framed.length);
        sendLocal(room, null, data);
    }

    private void sendLocal(String room, WebSocketConnection exclude, byte[] data) {
        var peers = rooms.get(room);
        if (peers == null) return;
        var buffer = Buffer.buffer(data);
        for (var peer : peers) {
            if ((exclude == null || !peer.id().equals(exclude.id())) && peer.isOpen()) {
                peer.sendBinary(buffer).subscribe().with(ignored -> {}, failure -> {});
            }
        }
    }

    private static byte[] uuidBytes(UUID id) {
        return ByteBuffer.allocate(16)
            .putLong(id.getMostSignificantBits())
            .putLong(id.getLeastSignificantBits())
            .array();
    }
}
