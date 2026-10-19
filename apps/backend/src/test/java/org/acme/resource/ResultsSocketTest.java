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
    SurveyService surveys;

    @Test
    void anonymousHostRequestOnlyListens() throws InterruptedException {
        String id = surveys.create("results-ws-owner-a", new CreateSurveyRequest("Live", null)).id();
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

    private io.quarkus.websockets.next.WebSocketClientConnection connectAsHost(String id, List<String> received) {
        return connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .path("/results-ws/" + id + "?role=host")
            .onTextMessage((c, message) -> received.add(message))
            .connectAndAwait();
    }
}
