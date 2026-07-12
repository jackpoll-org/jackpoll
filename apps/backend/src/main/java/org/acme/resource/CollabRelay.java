package org.acme.resource;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.pubsub.PubSubCommands;
import io.quarkus.websockets.next.WebSocketConnection;
import io.vertx.core.buffer.Buffer;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import org.jboss.logging.Logger;

import java.nio.ByteBuffer;
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

    private final Map<String, Set<WebSocketConnection>> rooms = new ConcurrentHashMap<>();
    private final byte[] selfTag = uuidBytes(UUID.randomUUID());

    @Inject
    Instance<RedisDataSource> redis;

    // Dedicated connection for publishing (a connection in subscribe mode can't
    // PUBLISH, so publishing and subscribing must not share one).
    private PubSubCommands<byte[]> publisher;
    // The active pattern subscription. MUST be kept referenced: the returned
    // RedisSubscriber owns the dedicated subscriber connection, so if it is
    // garbage-collected the subscription dies and cross-replica fan-out silently
    // stops — which left editors on different replicas unable to see each other.
    private PubSubCommands<byte[]> subscriberCommands;
    private PubSubCommands.RedisSubscriber subscription;

    @PostConstruct
    void init() {
        if (redis.isUnsatisfied()) {
            LOG.warn("Collab relay: Redis unavailable — single-replica fan-out only");
            return;
        }
        try {
            var ds = redis.get();
            publisher = ds.pubsub(byte[].class);
            subscriberCommands = ds.pubsub(byte[].class);
            subscription = subscriberCommands.subscribeToPattern(CHANNEL_PREFIX + "*", this::onRedis);
            LOG.info("Collab relay: Redis cross-replica pub/sub active");
        } catch (Exception e) {
            publisher = null;
            subscriberCommands = null;
            subscription = null;
            LOG.error("Collab relay: Redis pub/sub init failed — single-replica fan-out only", e);
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
        if (publisher != null) {
            var framed = new byte[TAG_LEN + data.length];
            System.arraycopy(selfTag, 0, framed, 0, TAG_LEN);
            System.arraycopy(data, 0, framed, TAG_LEN, data.length);
            try {
                publisher.publish(CHANNEL_PREFIX + room, framed);
            } catch (Exception e) {
                LOG.warnf(e, "Collab relay: cross-replica publish failed for room %s", room);
            }
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
