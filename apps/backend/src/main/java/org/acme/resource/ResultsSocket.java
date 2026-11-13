package org.acme.resource;

import io.quarkus.scheduler.Scheduled;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.websockets.next.CloseReason;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OpenConnections;
import io.quarkus.websockets.next.UserData.TypedKey;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.acme.entity.SurveyStatus;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.SurveyRepository;
import org.acme.service.AccessCodeService;
import org.acme.service.SurveyService;
import org.jboss.logging.Logger;

/**
 * Live-results WebSocket endpoint (wordcloud / live presentation). One room per
 * survey; viewers connect and listen for "updated" pings, then refetch the
 * aggregated results. The fan-out (local + cross-replica via Redis) lives in
 * {@link ResultsRelay}.
 *
 * Served under {@code /results-ws} (NOT {@code /results}) so the WebSocket prefix
 * does not shadow any frontend route — Traefik routes {@code /results-ws} here,
 * exactly like {@code /collab-ws}.
 *
 * Access is re-checked periodically like {@link CollabSocket}: removed members
 * lose the host role, and listeners whose survey is unpublished or whose access
 * code changed are closed.
 */
@WebSocket(path = "/results-ws/{surveyId}")
public class ResultsSocket {

    private static final Logger LOG = Logger.getLogger(ResultsSocket.class);
    private static final TypedKey<String> USER_ID = TypedKey.forString("userId");
    private static final TypedKey<Boolean> HOST = TypedKey.forBoolean("host");

    @Inject
    ResultsRelay relay;

    @Inject
    SurveyService surveyService;

    @Inject
    SecurityIdentity identity;

    @Inject
    SurveyRepository surveys;

    @Inject
    AccessCodeService accessCodes;

    @Inject
    OpenConnections connections;

    @OnOpen
    @ActivateRequestContext
    public void onOpen(WebSocketConnection connection) {
        String surveyId = room(connection);
        String userId = identity.isAnonymous() ? null : identity.getPrincipal().getName();
        boolean member = isMember(userId, surveyId);
        if (!member && !mayListen(connection, surveyId, new HashMap<>())) {
            connection.closeAndAwait(new CloseReason(CollabSocket.FORBIDDEN, "forbidden"));
            return;
        }
        if (userId != null) connection.userData().put(USER_ID, userId);
        boolean host = wantsHost(connection) && member;
        connection.userData().put(HOST, host);
        relay.register(surveyId, connection, host);
    }

    /** Skips connections whose onOpen has not registered them yet. */
    @Scheduled(every = "30s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void recheckAccess() {
        Map<String, Boolean> members = new HashMap<>();
        Map<List<String>, Boolean> listeners = new HashMap<>();
        for (var connection : connections.findByEndpointId(ResultsSocket.class.getName())) {
            if (connection.userData().get(HOST) == null) continue;
            try {
                recheck(connection, members, listeners);
            } catch (RuntimeException e) {
                LOG.warnf(e, "Results access re-check failed for connection %s", connection.id());
            }
        }
    }

    private void recheck(WebSocketConnection connection, Map<String, Boolean> members,
                         Map<List<String>, Boolean> listeners) {
        String surveyId = room(connection);
        String userId = connection.userData().get(USER_ID);
        boolean member = userId != null
            && members.computeIfAbsent(userId + "|" + surveyId, k -> isMember(userId, surveyId));
        if (!member && !mayListen(connection, surveyId, listeners)) {
            connection.userData().remove(HOST);
            relay.unregister(surveyId, connection);
            connection.close(new CloseReason(CollabSocket.FORBIDDEN, "forbidden"))
                .subscribe().with(ignored -> {}, failure -> {});
            return;
        }
        if (!member && Boolean.TRUE.equals(connection.userData().put(HOST, false))) {
            relay.demote(surveyId, connection);
        }
    }

    /** Anyone may follow a published survey's results, given its access code when it has one. */
    private boolean mayListen(WebSocketConnection connection, String surveyId, Map<List<String>, Boolean> cache) {
        var handshake = connection.handshakeRequest();
        String accessToken = handshake.header("X-Access-Token");
        String resumeToken = handshake.header("X-Resume-Token");
        return cache.computeIfAbsent(Arrays.asList(surveyId, accessToken, resumeToken), k -> {
            if (surveys.count("id = ?1 and status = ?2", surveyId, SurveyStatus.PUBLISHED) == 0) return false;
            try {
                accessCodes.requireAccess(surveyId, accessToken, resumeToken);
                return true;
            } catch (ForbiddenAccessException e) {
                return false;
            }
        });
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }

    /** Lobby check-ins go to members of the survey only; anyone else asking for the role just listens. */
    private boolean isMember(String userId, String surveyId) {
        if (userId == null) return false;
        try {
            surveyService.requireReadable(userId, surveyId);
            return true;
        } catch (ResourceNotFoundException e) {
            return false;
        }
    }

    /** The presenter connects with {@code ?role=host} to also receive host-only messages (lobby check-ins). */
    private static boolean wantsHost(WebSocketConnection connection) {
        var query = connection.handshakeRequest().query();
        if (query == null) return false;
        for (var param : query.split("&")) {
            if ("role=host".equals(param)) return true;
        }
        return false;
    }
}
