package org.acme.resource;

import io.quarkus.websockets.next.OnBinaryMessage;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

/**
 * Live co-editing WebSocket endpoint (issue #85). One room per survey; the
 * actual fan-out (local + cross-replica via Redis) lives in {@link CollabRelay}.
 * The CRDT merge runs client-side (Yjs); the DB autosave is the source of truth.
 *
 * Note: served under {@code /collab-ws} (NOT {@code /collab}) so the WebSocket
 * prefix does not shadow the frontend's {@code /collab/[slug]} passwordless edit
 * page — both share the host, and Traefik routes {@code /collab-ws} here.
 */
@WebSocket(path = "/collab-ws/{surveyId}")
public class CollabSocket {

    @Inject
    CollabRelay relay;

    @OnOpen
    public void onOpen(WebSocketConnection connection) {
        relay.register(room(connection), connection);
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    @OnBinaryMessage
    public void onMessage(WebSocketConnection connection, byte[] data) {
        relay.onClientMessage(room(connection), connection, data);
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }
}
