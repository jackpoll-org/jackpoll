package org.acme.resource;

import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

/**
 * Live-results WebSocket endpoint (wordcloud / live presentation). One room per
 * survey; viewers connect and listen for "updated" pings, then refetch the
 * aggregated results. The fan-out (local + cross-replica via Redis) lives in
 * {@link ResultsRelay}.
 *
 * Served under {@code /results-ws} (NOT {@code /results}) so the WebSocket prefix
 * does not shadow any frontend route — Traefik routes {@code /results-ws} here,
 * exactly like {@code /collab-ws}.
 */
@WebSocket(path = "/results-ws/{surveyId}")
public class ResultsSocket {

    @Inject
    ResultsRelay relay;

    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        relay.register(room(connection), connection, isHost(connection));
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }

    /**
     * The presenter connects with {@code ?role=host} to also receive host-only
     * messages (lobby check-ins). Unauthenticated on purpose: check-ins are
     * nicknames players chose to show on the big screen, so claiming the role
     * reveals nothing private.
     */
    private static boolean isHost(WebSocketConnection connection) {
        var query = connection.handshakeRequest().query();
        if (query == null) return false;
        for (var param : query.split("&")) {
            if ("role=host".equals(param)) return true;
        }
        return false;
    }
}
