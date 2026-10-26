package org.acme.resource;

import io.quarkus.scheduler.Scheduled;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.websockets.next.CloseReason;
import io.quarkus.websockets.next.OnBinaryMessage;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OpenConnections;
import io.quarkus.websockets.next.UserData.TypedKey;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

import org.acme.exception.ResourceNotFoundException;
import org.acme.service.CollabLinkService;
import org.acme.service.SurveyService;
import org.jboss.logging.Logger;

/**
 * Live co-editing WebSocket endpoint (issue #85). One room per survey; the
 * actual fan-out (local + cross-replica via Redis) lives in {@link CollabRelay}.
 * The CRDT merge runs client-side (Yjs); the DB autosave is the source of truth.
 *
 * Note: served under {@code /collab-ws} (NOT {@code /collab}) so the WebSocket
 * prefix does not shadow the frontend's {@code /collab/[slug]} passwordless edit
 * page — both share the host, and Traefik routes {@code /collab-ws} here.
 *
 * Browsers cannot set headers on a WebSocket, so credentials travel in the
 * {@code bearer-token-carrier} sub-protocol: a bearer token for members and the
 * edit-link slug ({@code X-Collab-Link}) on {@code /collab/<slug>}, both when a
 * signed-in user opens an edit link. Owners, editors and link holders may write;
 * viewers may only request state and share presence. Access is re-checked
 * periodically, so removed members and holders of a disabled link lose it.
 */
@WebSocket(path = "/collab-ws/{surveyId}")
public class CollabSocket {

    /** Application close code for "no access"; the client must not reconnect on it. */
    static final int FORBIDDEN = 4403;
    private static final Logger LOG = Logger.getLogger(CollabSocket.class);
    private static final TypedKey<Boolean> EDITABLE = TypedKey.forBoolean("editable");
    private static final TypedKey<String> USER_ID = TypedKey.forString("userId");
    private static final byte MSG_SYNC = 0;
    private static final byte MSG_AWARENESS = 1;
    private static final byte SYNC_STEP1 = 0;
    static final byte MSG_READ_ONLY = 9;

    @Inject
    CollabRelay relay;

    @Inject
    SurveyService surveyService;

    @Inject
    CollabLinkService collabLinks;

    @Inject
    SecurityIdentity identity;

    @Inject
    OpenConnections connections;

    @OnOpen
    @ActivateRequestContext
    public void onOpen(WebSocketConnection connection) {
        if (!identity.isAnonymous()) {
            connection.userData().put(USER_ID, identity.getPrincipal().getName());
        }
        if (!authorize(connection, new HashMap<>())) return;
        relay.register(room(connection), connection);
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    @OnBinaryMessage
    public void onMessage(WebSocketConnection connection, byte[] data) {
        var editable = connection.userData().get(EDITABLE);
        if (editable == null || !mayRelay(data, editable)) {
            return;
        }
        relay.onClientMessage(room(connection), connection, data);
    }

    /** Covers silent clients too. Skips connections whose onOpen has not authorized them yet. */
    @Scheduled(every = "30s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void recheckAccess() {
        Map<String, Boolean> lookups = new HashMap<>();
        for (var connection : connections.findByEndpointId(CollabSocket.class.getName())) {
            if (connection.userData().get(EDITABLE) == null) continue;
            try {
                authorize(connection, lookups);
            } catch (RuntimeException e) {
                LOG.warnf(e, "Collab access re-check failed for connection %s", connection.id());
            }
        }
    }

    /** Resolve and store the caller's access; closes the connection when there is none. */
    private boolean authorize(WebSocketConnection connection, Map<String, Boolean> lookups) {
        var room = room(connection);
        var userId = connection.userData().get(USER_ID);
        var slug = connection.handshakeRequest().header("X-Collab-Link");
        Boolean editable = userId == null ? null
            : cached(lookups, "user|" + userId + "|" + room, () -> memberCanEdit(userId, room));
        if (!Boolean.TRUE.equals(editable) && slug != null
                && cached(lookups, "link|" + slug + "|" + room, () -> room.equals(collabLinks.validSurveyId(slug)))) {
            editable = true;
        }
        if (editable == null) {
            connection.userData().remove(EDITABLE);
            relay.unregister(room, connection);
            connection.close(new CloseReason(FORBIDDEN, "forbidden")).subscribe().with(ignored -> {}, failure -> {});
            return false;
        }
        var previous = connection.userData().put(EDITABLE, editable);
        if (!editable.equals(previous) && !(previous == null && editable)) {
            connection.sendBinary(io.vertx.core.buffer.Buffer.buffer(
                    new byte[] {MSG_READ_ONLY, (byte) (editable ? 0 : 1)}))
                .subscribe().with(ignored -> {}, failure -> {});
        }
        return true;
    }

    /** Whether a member may edit, or null for a non-member. */
    private Boolean memberCanEdit(String userId, String room) {
        try {
            return surveyService.canEdit(userId, surveyService.requireReadable(userId, room));
        } catch (ResourceNotFoundException e) {
            return null;
        }
    }

    private static Boolean cached(Map<String, Boolean> lookups, String key, Supplier<Boolean> lookup) {
        if (!lookups.containsKey(key)) lookups.put(key, lookup.get());
        return lookups.get(key);
    }

    static boolean mayRelay(byte[] data, boolean editable) {
        if (data.length == 0 || (data[0] != MSG_SYNC && data[0] != MSG_AWARENESS)) return false;
        return editable || isReadOnlyMessage(data);
    }

    static boolean isReadOnlyMessage(byte[] data) {
        if (data.length == 0) return false;
        if (data[0] == MSG_AWARENESS) return true;
        return data[0] == MSG_SYNC && data.length > 1 && data[1] == SYNC_STEP1;
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }
}
