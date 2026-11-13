package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.websockets.next.BasicWebSocketConnector;
import io.quarkus.websockets.next.WebSocketClientConnection;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.function.BooleanSupplier;
import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.service.CollabLinkService;
import org.acme.service.SurveyService;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CollabSocketTest {

    @TestHTTPResource("/")
    URI baseUri;

    @Inject
    BasicWebSocketConnector connector;

    @Inject
    SurveyService surveys;

    @Inject
    CollabLinkService collabLinks;

    @Inject
    CollabSocket socket;

    @Test
    void anonymousConnectionWithoutCredentialsIsClosed() {
        var connection = connect("any-survey");
        waitUntil(connection::isClosed, 5000);
        assertEquals(CollabSocket.FORBIDDEN, connection.closeReason().getCode());
    }

    @Test
    void editLinkGuestCanJoinWithTheSlugAndIsClosedOnceTheLinkIsDisabled() {
        String owner = "collab-ws-link-owner";
        String id = surveys.create(owner, new CreateSurveyRequest("Shared", null)).id();
        String slug = collabLinks.rotate(owner, id).slug();

        var guest = connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .addHeader("X-Collab-Link", slug)
            .path("/collab-ws/" + id)
            .connectAndAwait();
        waitUntil(guest::isClosed, 300);
        assertTrue(guest.isOpen());

        collabLinks.disable(owner, id);
        socket.recheckAccess();
        waitUntil(guest::isClosed, 5000);
        assertEquals(CollabSocket.FORBIDDEN, guest.closeReason().getCode());
    }

    @Test
    void everyHeaderInTheSubProtocolIsRead() {
        String owner = "collab-ws-subprotocol-owner";
        String id = surveys.create(owner, new CreateSurveyRequest("Shared", null)).id();
        String slug = collabLinks.rotate(owner, id).slug();

        var guest = connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .addSubprotocol("bearer-token-carrier")
            .addSubprotocol(URLEncoder.encode("quarkus-http-upgrade#X-Other#1", StandardCharsets.UTF_8))
            .addSubprotocol(URLEncoder.encode("quarkus-http-upgrade#X-Collab-Link#" + slug, StandardCharsets.UTF_8))
            .addSubprotocol(URLEncoder.encode("quarkus-http-upgrade#X-Another#2", StandardCharsets.UTF_8))
            .path("/collab-ws/" + id)
            .connectAndAwait();
        waitUntil(guest::isClosed, 300);
        assertTrue(guest.isOpen());
        guest.close().await().indefinitely();
    }

    @Test
    @TestSecurity(user = "collab-ws-link-stranger")
    void signedInNonMemberCanJoinWithTheSlug() {
        String id = surveys.create("collab-ws-link-owner-2", new CreateSurveyRequest("Shared", null)).id();
        String slug = collabLinks.rotate("collab-ws-link-owner-2", id).slug();

        var guest = connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .addHeader("X-Collab-Link", slug)
            .path("/collab-ws/" + id)
            .connectAndAwait();
        waitUntil(guest::isClosed, 300);
        assertTrue(guest.isOpen());
        guest.close().await().indefinitely();
    }

    @Test
    @TestSecurity(user = "collab-ws-owner")
    void ownerCanJoinTheirSurveyRoom() {
        String id = given().contentType(ContentType.JSON)
            .body("{\"title\":\"Live\"}")
            .when().post("/api/v1/surveys")
            .then().statusCode(201)
            .extract().path("data.id");

        var connection = connect(id);
        waitUntil(connection::isClosed, 300);
        assertTrue(connection.isOpen());
        connection.close().await().indefinitely();
    }

    @Test
    @TestSecurity(user = "collab-ws-stranger")
    void strangerIsClosedWithPolicyViolation() {
        var connection = connect("not-their-survey");
        waitUntil(connection::isClosed, 5000);
        assertEquals(CollabSocket.FORBIDDEN, connection.closeReason().getCode());
    }

    private static void waitUntil(BooleanSupplier condition, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(25);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private WebSocketClientConnection connect(String surveyId) {
        return connector.baseUri(baseUri)
            .addHeader("Origin", "http://localhost:3000")
            .path("/collab-ws/" + surveyId)
            .connectAndAwait();
    }

    @Test
    void viewersMayOnlyRequestStateAndSharePresence() {
        assertTrue(CollabSocket.isReadOnlyMessage(new byte[] {1, 5}));
        assertTrue(CollabSocket.isReadOnlyMessage(new byte[] {0, 0, 3}));
        assertFalse(CollabSocket.isReadOnlyMessage(new byte[] {0, 1, 3}));
        assertFalse(CollabSocket.isReadOnlyMessage(new byte[] {0, 2, 3}));
        assertFalse(CollabSocket.isReadOnlyMessage(new byte[0]));
    }

    @Test
    void onlyYjsMessagesAreRelayed() {
        assertFalse(CollabSocket.mayRelay(new byte[] {CollabSocket.MSG_READ_ONLY, 1}, true));
        assertTrue(CollabSocket.mayRelay(new byte[] {0, 2, 3}, true));
        assertFalse(CollabSocket.mayRelay(new byte[] {0, 2, 3}, false));
        assertTrue(CollabSocket.mayRelay(new byte[] {1, 5}, false));
    }

    @Test
    void oversizedPresenceAndStateRequestsAreDropped() {
        byte[] awareness = new byte[CollabSocket.MAX_AWARENESS_BYTES + 1];
        awareness[0] = 1;
        assertFalse(CollabSocket.mayRelay(awareness, true));
        byte[] step1 = new byte[CollabSocket.MAX_SYNC_STEP1_BYTES + 1];
        assertFalse(CollabSocket.mayRelay(step1, true));
        byte[] update = new byte[CollabSocket.MAX_SYNC_STEP1_BYTES + 1];
        update[1] = 2;
        assertTrue(CollabSocket.mayRelay(update, true));
    }

    @Test
    void throttleCapsMessagesAndBytesPerSecond() {
        var messages = new CollabSocket.Throttle(0);
        for (int i = 0; i < 50; i++) assertTrue(messages.allow(10, 0));
        assertFalse(messages.allow(10, 0));
        var refilled = new CollabSocket.Throttle(0);
        for (int i = 0; i < 50; i++) refilled.allow(10, 0);
        assertTrue(refilled.allow(10, 1_000_000_000L));

        var bytes = new CollabSocket.Throttle(0);
        assertTrue(bytes.allow(8 << 20, 0));
        assertFalse(bytes.allow(1, 0));
        var bytesRefilled = new CollabSocket.Throttle(0);
        bytesRefilled.allow(8 << 20, 0);
        assertTrue(bytesRefilled.allow(2 << 20, 1_000_000_000L));
    }

    @Test
    void throttleLetsSeveralPeersSyncALargeDocumentAtOnce() {
        var throttle = new CollabSocket.Throttle(0);
        for (int peer = 0; peer < 3; peer++) assertTrue(throttle.allow(1 << 20, 0));
    }

    @Test
    void connectionCapsLeaveRoomForReconnectsAndClassroomsBehindNat() {
        assertEquals(10, CollabSocket.MAX_CONNECTIONS_PER_USER);
        assertEquals(60, CollabSocket.MAX_CONNECTIONS_PER_ANONYMOUS_IP);
    }

    @Test
    @TestSecurity(user = "collab-ws-many-tabs")
    void oneUserMayOnlyHoldAFewConnectionsPerRoom() {
        String id = surveys.create("collab-ws-many-tabs", new CreateSurveyRequest("Tabs", null)).id();
        var open = new java.util.ArrayList<WebSocketClientConnection>();
        for (int i = 0; i < CollabSocket.MAX_CONNECTIONS_PER_USER; i++) {
            var connection = connect(id);
            waitUntil(connection::isClosed, 300);
            assertTrue(connection.isOpen());
            open.add(connection);
        }

        var extra = connect(id);
        waitUntil(extra::isClosed, 5000);
        assertEquals(CollabSocket.POLICY_VIOLATION, extra.closeReason().getCode());
        open.forEach(c -> c.close().await().indefinitely());
    }

    @Test
    @TestSecurity(user = "collab-ws-flooder")
    void floodingConnectionIsClosedWithPolicyViolation() {
        String id = surveys.create("collab-ws-flooder", new CreateSurveyRequest("Flood", null)).id();
        var connection = connect(id);
        waitUntil(connection::isClosed, 300);
        assertTrue(connection.isOpen());

        for (int i = 0; i < 200 && connection.isOpen(); i++) {
            connection.sendBinary(io.vertx.core.buffer.Buffer.buffer(new byte[] {1, 1, 0}))
                .subscribe().with(ignored -> {}, failure -> {});
        }
        waitUntil(connection::isClosed, 5000);
        assertEquals(CollabSocket.POLICY_VIOLATION, connection.closeReason().getCode());
    }
}
