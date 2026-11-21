package org.acme.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.acme.entity.LiveSession;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class LiveSessionRepository implements PanacheRepositoryBase<LiveSession, String> {

    /** A survey's sessions, newest first. */
    public List<LiveSession> findBySurvey(String surveyId) {
        return list("surveyId", Sort.by("startedAt").descending(), surveyId);
    }

    /** The session a live answer arriving now belongs to: the latest one started. */
    public Optional<LiveSession> findCurrent(String surveyId) {
        return find("surveyId = ?1 and kind = ?2", Sort.by("startedAt").descending(), surveyId, LiveSession.LIVE)
            .firstResultOptional();
    }

    public long deleteBySurvey(String surveyId) {
        return delete("surveyId = ?1 and kind = ?2", surveyId, LiveSession.LIVE);
    }

    public long deleteAllBySurvey(String surveyId) {
        return delete("surveyId", surveyId);
    }

    public List<LiveSession> findScheduled(String surveyId) {
        return list("surveyId = ?1 and kind = ?2", Sort.by("opensAt").descending(), surveyId, LiveSession.SCHEDULED);
    }

    public boolean hasScheduled(String surveyId) {
        return countScheduled(surveyId) > 0;
    }

    public long countScheduled(String surveyId) {
        return count("surveyId = ?1 and kind = ?2", surveyId, LiveSession.SCHEDULED);
    }

    public List<LiveSession> findSnapshotted(String surveyId) {
        return list("surveyId = ?1 and kind = ?2 and snapshot is not null", Sort.by("snapshotAt").descending(),
            surveyId, LiveSession.SCHEDULED);
    }

    public Optional<LiveSession> findScheduled(String surveyId, String runId) {
        return find("id = ?1 and surveyId = ?2 and kind = ?3", runId, surveyId, LiveSession.SCHEDULED)
            .firstResultOptional();
    }

    public List<LiveSession> findDueSnapshots(Instant now) {
        return list("kind = ?1 and snapshot is null and closedAt is null and opensAt <= ?2 and closesAt > ?2",
            LiveSession.SCHEDULED, now);
    }
}
