package org.acme.resource;

import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.websockets.next.CloseReason;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.control.ActivateRequestContext;
import jakarta.inject.Inject;

import org.acme.entity.SurveyStatus;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.SurveyRepository;
import org.acme.service.AccessCodeService;
import org.acme.service.SurveyService;

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

    @Inject
    SurveyService surveyService;

    @Inject
    SecurityIdentity identity;

    @Inject
    SurveyRepository surveys;

    @Inject
    AccessCodeService accessCodes;

    @OnOpen
    @ActivateRequestContext
    public void onOpen(WebSocketConnection connection) {
        String surveyId = room(connection);
        boolean member = isMember(surveyId);
        if (!member && !mayListen(connection, surveyId)) {
            connection.closeAndAwait(new CloseReason(CollabSocket.FORBIDDEN, "forbidden"));
            return;
        }
        relay.register(surveyId, connection, wantsHost(connection) && member);
    }

    /** Anyone may follow a published survey's results, given its access code when it has one. */
    private boolean mayListen(WebSocketConnection connection, String surveyId) {
        var published = surveys.findByIdOptional(surveyId)
            .filter(s -> s.status == SurveyStatus.PUBLISHED).isPresent();
        if (!published) return false;
        var handshake = connection.handshakeRequest();
        try {
            accessCodes.requireAccess(surveyId,
                handshake.header("X-Access-Token"), handshake.header("X-Resume-Token"));
            return true;
        } catch (ForbiddenAccessException e) {
            return false;
        }
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        relay.unregister(room(connection), connection);
    }

    private static String room(WebSocketConnection connection) {
        return connection.pathParam("surveyId");
    }

    /** Lobby check-ins go to members of the survey only; anyone else asking for the role just listens. */
    private boolean isMember(String surveyId) {
        if (identity.isAnonymous()) return false;
        try {
            surveyService.requireReadable(identity.getPrincipal().getName(), surveyId);
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
