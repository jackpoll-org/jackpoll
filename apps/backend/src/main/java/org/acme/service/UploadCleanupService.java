package org.acme.service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.jboss.logging.Logger;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;

/**
 * Deletes stored uploads nothing refers to any more (Art. 17 / Art. 5(1)(e) DSGVO).
 *
 * <p>Uploads are referenced from many places (answers, drafts, survey branding,
 * question images, templates), and survey content can be copied,
 * so instead of deleting files on each code path the nightly sweep removes every
 * object no row mentions. The grace period covers files uploaded for answers that
 * are still being filled in or queued offline.
 */
@ApplicationScoped
public class UploadCleanupService {

    private static final Logger LOG = Logger.getLogger(UploadCleanupService.class);
    static final Duration GRACE = Duration.ofDays(7);
    private static final List<String> TABLES = List.of(
        "surveys", "questions", "question_options", "response_answers",
        "response_drafts", "templates"
    );
    private static final String KEY_PATTERN = "uploads(/|%2[Ff])([A-Za-z0-9-]+\\.[a-z0-9]+)";

    @Inject
    EntityManager em;

    @Inject
    StorageService storage;

    @Scheduled(cron = "0 30 3 * * ?", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void nightly() {
        int deleted = sweep(Instant.now().minus(GRACE));
        LOG.infof("Upload cleanup: deleted %d unreferenced file(s)", deleted);
    }

    /** Delete unreferenced uploads last modified before {@code cutoff}; returns how many. */
    public int sweep(Instant cutoff) {
        var referenced = referencedKeys();
        var deleted = new java.util.concurrent.atomic.AtomicInteger();
        storage.uploads()
            .filter(object -> object.lastModified().isBefore(cutoff) && !referenced.contains(object.key()))
            .forEach(object -> {
                storage.delete(object.key());
                deleted.incrementAndGet();
            });
        return deleted.get();
    }

    @Transactional
    @SuppressWarnings("unchecked")
    Set<String> referencedKeys() {
        var keys = new HashSet<String>();
        for (var table : TABLES) {
            var exists = em.createNativeQuery("SELECT to_regclass(:t) IS NOT NULL")
                .setParameter("t", table).getSingleResult();
            if (!Boolean.TRUE.equals(exists)) continue;
            List<String> names = em.createNativeQuery(
                    "SELECT DISTINCT (regexp_matches(CAST(t AS text), '" + KEY_PATTERN + "', 'g'))[2] FROM " + table + " t")
                .getResultList();
            names.forEach(name -> keys.add("uploads/" + name));
        }
        return keys;
    }
}
