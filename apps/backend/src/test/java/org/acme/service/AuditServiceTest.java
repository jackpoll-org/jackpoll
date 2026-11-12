package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.acme.repository.AuditEventRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class AuditServiceTest {

    @Inject
    ApiKeyService apiKeys;

    @Inject
    AuditEventRepository events;

    @Test
    void creatingAndRevokingAnApiKeyIsAudited() {
        String userId = UUID.randomUUID().toString();
        String keyId = apiKeys.create(userId, "ci", false, null).apiKey().id();
        apiKeys.delete(userId, keyId);

        var trail = QuarkusTransaction.requiringNew().call(() -> events.findByActor(userId));
        assertEquals(Set.of("api_key.create:" + keyId, "api_key.delete:" + keyId),
            trail.stream().map(e -> e.action + ":" + e.target).collect(Collectors.toSet()));
    }

    @Test
    void anActionThatRollsBackLeavesNoEntry() {
        String userId = UUID.randomUUID().toString();
        assertThrows(IllegalStateException.class, () -> QuarkusTransaction.requiringNew().run(() -> {
            apiKeys.create(userId, "ci", false, null);
            throw new IllegalStateException("rollback");
        }));
        assertEquals(0L, QuarkusTransaction.requiringNew().call(() -> events.count("actorId", userId)));
    }
}
