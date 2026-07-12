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
        relay.register(room(connection), connection);
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }
}
