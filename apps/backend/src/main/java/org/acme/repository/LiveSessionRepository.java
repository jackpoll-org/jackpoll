package org.acme.repository;

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
        return find("surveyId", Sort.by("startedAt").descending(), surveyId).firstResultOptional();
    }

    public long deleteBySurvey(String surveyId) {
        return delete("surveyId", surveyId);
    }
}
