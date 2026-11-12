package org.acme.service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.acme.entity.AuditEvent;
import org.acme.repository.AuditEventRepository;
import org.jboss.logging.Logger;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Append-only trail of security-relevant changes (keys, sharing, deletions,
 * passwords). Written in the caller's transaction, so an action that rolls back
 * leaves no entry; kept for a year, long enough to investigate an incident.
 */
@ApplicationScoped
public class AuditService {

    private static final Logger LOG = Logger.getLogger("audit");
    private static final Duration RETENTION = Duration.ofDays(365);

    @Inject
    AuditEventRepository events;

    @Transactional
    public void record(String actorId, String action, String target) {
        var event = new AuditEvent();
        event.id = UUID.randomUUID().toString();
        event.actorId = actorId;
        event.action = action;
        event.target = target == null || target.length() <= 255 ? target : target.substring(0, 255);
        event.createdAt = Instant.now();
        events.persist(event);
        LOG.infof("action=%s actor=%s target=%s", action, actorId, event.target);
    }

    @Scheduled(cron = "0 45 3 * * ?", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    @Transactional
    void purgeExpired() {
        events.deleteOlderThan(Instant.now().minus(RETENTION));
    }
}
