package org.acme.resource;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import io.quarkus.redis.datasource.ReactiveRedisDataSource;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.inject.Instance;

/**
 * Pure unit tests for the results fan-out (no Quarkus boot, no Redis). The
 * scheduled flush is effectively disabled (1h interval) so each test drives
 * {@link ResultsRelay#flushPings()} itself.
 */
class ResultsRelayTest {

    private static final String SURVEY = "survey-1";

    private ResultsRelay relay;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        Instance<ReactiveRedisDataSource> redis = mock(Instance.class);
        when(redis.isUnsatisfied()).thenReturn(true);
        relay = new ResultsRelay();
        relay.redis = redis;
        relay.pingIntervalMs = 3_600_000;
        relay.init();
    }

    @AfterEach
    void tearDown() {
        relay.shutdown();
    }

    private static WebSocketConnection peer() {
        var conn = mock(WebSocketConnection.class);
        when(conn.isOpen()).thenReturn(true);
        when(conn.sendText(anyString())).thenReturn(Uni.createFrom().voidItem());
        return conn;
    }

    @Test
    void burstOfUpdatedPingsReachesEachViewerOnce() {
        var a = peer();
        var b = peer();
        relay.register(SURVEY, a, false);
        relay.register(SURVEY, b, false);

        for (int i = 0; i < 500; i++) relay.broadcast(SURVEY, "updated");
        verify(a, never()).sendText(anyString());

        relay.flushPings();

        verify(a, timeout(2000).times(1)).sendText("updated");
        verify(b, timeout(2000).times(1)).sendText("updated");
    }

    @Test
    void flushWithNothingPendingSendsNothing() {
        var a = peer();
        relay.register(SURVEY, a, false);

        relay.flushPings();

        verify(a, after(200).never()).sendText(anyString());
    }

    @Test
    void nonPingMessagesAreDeliveredWithoutWaitingForAFlush() {
        var a = peer();
        relay.register(SURVEY, a, false);

        relay.broadcast(SURVEY, "{\"live\":{\"index\":0,\"phase\":\"question\"}}");
        relay.broadcast(SURVEY, "{\"words\":[\"a\"]}");

        verify(a, timeout(2000)).sendText("{\"live\":{\"index\":0,\"phase\":\"question\"}}");
        verify(a, timeout(2000)).sendText("{\"words\":[\"a\"]}");
    }

    @Test
    void hostMessagesSkipParticipants() {
        var host = peer();
        var player = peer();
        relay.register(SURVEY, host, true);
        relay.register(SURVEY, player, false);

        relay.broadcastToHosts(SURVEY, "{\"join\":{\"name\":\"Ada\"}}");

        verify(host, timeout(2000)).sendText("{\"join\":{\"name\":\"Ada\"}}");
        verify(player, after(200).never()).sendText(anyString());
    }

    @Test
    void hostsStillReceiveRoomWideMessages() {
        var host = peer();
        relay.register(SURVEY, host, true);

        relay.broadcast(SURVEY, "updated");
        relay.flushPings();

        verify(host, timeout(2000).times(1)).sendText("updated");
    }

    @Test
    void unregisteredViewersGetNothing() {
        var a = peer();
        relay.register(SURVEY, a, true);
        relay.unregister(SURVEY, a);

        relay.broadcastToHosts(SURVEY, "{\"join\":{\"name\":\"Ada\"}}");
        relay.broadcast(SURVEY, "updated");
        relay.flushPings();

        verify(a, after(200).never()).sendText(anyString());
    }
}
