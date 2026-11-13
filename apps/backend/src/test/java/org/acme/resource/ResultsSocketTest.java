package org.acme.resource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.websockets.next.BasicWebSocketConnector;
import jakarta.inject.Inject;
import java.net.URI;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.service.SurveyService;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ResultsSocketTest {

    private static final String JOIN = "{\"join\":{\"name\":\"Ada\"}}";

    @TestHTTPResource("/")
    URI baseUri;

    @Inject
    BasicWebSocketConnector connector;

    @Inject
    ResultsRelay relay;

    @Inject
    ResultsSocket socket;

    @Inject
    SurveyService surveys;

    @Inject
    org.acme.repository.SurveyRepository surveyRepository;

    @Inject
    org.acme.repository.AccessCodeRepository accessCodeRepository;

    private String publishedSurvey(String owner, boolean requireCode) {
        String id = surveys.create(owner, new CreateSurveyRequest("Live", null)).id();
        io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().run(() -> {
            surveyRepository.findById(id).status = org.acme.entity.SurveyStatus.PUBLISHED;
            if (requireCode) {
                var code = new org.acme.entity.AccessCode();
                code.id = java.util.UUID.randomUUID().toString();
                code.surveyId = id;
                code.code = "SECRET12";
                code.requireCode = true;
                accessCodeRepository.persist(code);
            }
        });
        return id;
    }

    private List<String> listen(String id) throws InterruptedException {
        List<String> received = new CopyOnWriteArrayList<>();
        var connection = connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id)
            .onTextMessage((c, message) -> received.add(message))
            .connectAndAwait();
        Thread.sleep(300);
        relay.broadcast(id, "{\"updated\":true}");
        Thread.sleep(500);
        if (connection.isOpen()) connection.close().await().indefinitely();
        return received;
    }

    @Test
    void anonymousViewersFollowAPublishedSurvey() throws InterruptedException {
        assertEquals(1, listen(publishedSurvey("results-ws-owner-c", false)).size());
    }

    @Test
    void anonymousViewersNeedTheAccessCode() throws InterruptedException {
        assertTrue(listen(publishedSurvey("results-ws-owner-d", true)).isEmpty());
    }

    @Test
    void anonymousViewersCannotFollowADraft() throws InterruptedException {
        String id = surveys.create("results-ws-owner-e", new CreateSurveyRequest("Draft", null)).id();
        assertTrue(listen(id).isEmpty());
    }

    @Test
    void anonymousHostRequestOnlyListens() throws InterruptedException {
        String id = publishedSurvey("results-ws-owner-a", false);
        List<String> received = new CopyOnWriteArrayList<>();
        var connection = connectAsHost(id, received);
        Thread.sleep(300);

        relay.broadcastToHosts(id, JOIN);
        Thread.sleep(500);
        assertTrue(received.isEmpty());
        connection.close().await().indefinitely();
    }

    @Test
    @TestSecurity(user = "results-ws-owner-b")
    void memberHostReceivesCheckIns() throws InterruptedException {
        String id = surveys.create("results-ws-owner-b", new CreateSurveyRequest("Live", null)).id();
        List<String> received = new CopyOnWriteArrayList<>();
        var connection = connectAsHost(id, received);
        Thread.sleep(300);

        relay.broadcastToHosts(id, JOIN);
        long deadline = System.currentTimeMillis() + 5000;
        while (received.isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(25);
        assertEquals(List.of(JOIN), received);
        connection.close().await().indefinitely();
    }

    @Test
    void listenerIsClosedOnceTheSurveyIsNoLongerPublished() throws InterruptedException {
        String id = publishedSurvey("results-ws-owner-f", false);
        var connection = connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id)
            .connectAndAwait();
        Thread.sleep(300);
        assertTrue(connection.isOpen());

        io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().run(() ->
            surveyRepository.findById(id).status = org.acme.entity.SurveyStatus.DRAFT);
        socket.recheckAccess();
        long deadline = System.currentTimeMillis() + 5000;
        while (!connection.isClosed() && System.currentTimeMillis() < deadline) Thread.sleep(25);
        assertEquals(CollabSocket.FORBIDDEN, connection.closeReason().getCode());
    }

    @Test
    void oneRecheckClosesEveryListenerSharingTheSameCredentials() throws InterruptedException {
        String id = publishedSurvey("results-ws-owner-g", false);
        var first = connector.baseUri(baseUri).addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id).connectAndAwait();
        var second = connector.baseUri(baseUri).addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id).connectAndAwait();
        Thread.sleep(300);
        socket.recheckAccess();
        Thread.sleep(300);
        assertTrue(first.isOpen() && second.isOpen());

        io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().run(() ->
            surveyRepository.findById(id).status = org.acme.entity.SurveyStatus.DRAFT);
        socket.recheckAccess();
        long deadline = System.currentTimeMillis() + 5000;
        while (!(first.isClosed() && second.isClosed()) && System.currentTimeMillis() < deadline) Thread.sleep(25);
        assertEquals(CollabSocket.FORBIDDEN, first.closeReason().getCode());
        assertEquals(CollabSocket.FORBIDDEN, second.closeReason().getCode());
    }

    private io.quarkus.websockets.next.WebSocketClientConnection connectAsHost(String id, List<String> received) {
        return connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id + "?role=host")
            .onTextMessage((c, message) -> received.add(message))
            .connectAndAwait();
    }
}
