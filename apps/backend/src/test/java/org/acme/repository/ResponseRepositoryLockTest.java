package org.acme.repository;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.acme.exception.RateLimitedException;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class ResponseRepositoryLockTest {

    @Inject
    ResponseRepository responses;

    @Test
    void aHeldLockThrottlesInsteadOfWaitingAndFreesOnCommit() throws Exception {
        String key = "lock-test-" + UUID.randomUUID();
        var held = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var holder = CompletableFuture.runAsync(() -> QuarkusTransaction.requiringNew().run(() -> {
            responses.lockOrThrottle(key);
            held.countDown();
            try {
                release.await(10, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }));
        held.await(10, TimeUnit.SECONDS);

        assertThrows(RateLimitedException.class,
            () -> QuarkusTransaction.requiringNew().run(() -> responses.lockOrThrottle(key)));

        release.countDown();
        holder.get(10, TimeUnit.SECONDS);
        assertDoesNotThrow(() -> QuarkusTransaction.requiringNew().run(() -> responses.lockOrThrottle(key)));
    }
}
