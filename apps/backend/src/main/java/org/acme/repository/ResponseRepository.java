package org.acme.repository;

import java.time.Instant;
import java.util.List;

import org.acme.entity.SurveyResponse;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ResponseRepository implements PanacheRepositoryBase<SurveyResponse, String> {

    /** Real responses for a survey (preview/test submissions excluded). */
    public List<SurveyResponse> findBySurvey(String surveyId) {
        return findBySurvey(surveyId, false);
    }

    /** Responses for a survey; pass {@code includePreview} to include test ones. */
    public List<SurveyResponse> findBySurvey(String surveyId, boolean includePreview) {
        var sort = Sort.by("submittedAt").descending();
        return includePreview
            ? list("surveyId", sort, surveyId)
            : list("surveyId = ?1 and preview = false", sort, surveyId);
    }

    /** Responses for a survey, optionally narrowed to one live quiz session
     *  ({@code sessionId} null = every session and non-live responses). */
    public List<SurveyResponse> findBySurvey(
            String surveyId, boolean includePreview, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return findBySurvey(surveyId, includePreview);
        var sort = Sort.by("submittedAt").descending();
        return includePreview
            ? list("surveyId = ?1 and sessionId = ?2", sort, surveyId, sessionId)
            : list("surveyId = ?1 and sessionId = ?2 and preview = false", sort, surveyId, sessionId);
    }

    /** Per live session: [sessionId, response count, distinct player names]. */
    public List<Object[]> sessionStats(String surveyId) {
        return getEntityManager().createQuery(
                "select r.sessionId, count(r), count(distinct lower(trim(r.respondentName)))"
                    + " from SurveyResponse r"
                    + " where r.surveyId = ?1 and r.sessionId is not null and r.preview = false"
                    + " group by r.sessionId", Object[].class)
            .setParameter(1, surveyId)
            .getResultList();
    }

    /** Live leaderboard rows for one session: [trimmed name, total score], best first. */
    public List<Object[]> leaderboard(String surveyId, String sessionId, int limit) {
        return getEntityManager().createQuery(
                "select trim(r.respondentName), coalesce(sum(r.score), 0) from SurveyResponse r"
                    + " where r.surveyId = ?1 and r.sessionId = ?2 and r.preview = false"
                    + " and r.respondentName is not null and trim(r.respondentName) <> ''"
                    + " group by trim(r.respondentName)"
                    + " order by coalesce(sum(r.score), 0) desc, trim(r.respondentName) asc",
                Object[].class)
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .setMaxResults(limit)
            .getResultList();
    }

    /** Count real responses (preview excluded — they don't count to limits). */
    public long countBySurvey(String surveyId) {
        return count("surveyId = ?1 and preview = false", surveyId);
    }

    /** Delete all preview/test responses for a survey (owner "delete now").
     *  Deletes via entities so the answers cascade (a bulk JPQL delete would
     *  hit the response_answers FK). */
    public long deletePreviewBySurvey(String surveyId) {
        var rows = list("surveyId = ?1 and preview = true", surveyId);
        rows.forEach(this::delete);
        return rows.size();
    }

    /** Delete preview responses older than {@code cutoff} (auto-purge job). */
    public long deletePreviewOlderThan(Instant cutoff) {
        var rows = list("preview = true and submittedAt < ?1", cutoff);
        rows.forEach(this::delete);
        return rows.size();
    }

    /** Whether a given browser (hashed client id) already responded (#31). */
    public boolean existsByClientId(String surveyId, String clientId) {
        return count("surveyId = ?1 and clientId = ?2", surveyId, clientId) > 0;
    }

    /** Count responses submitted at/after an instant — for digests (#24). */
    public long countBySurveySince(String surveyId, Instant since) {
        return count("surveyId = ?1 and submittedAt >= ?2", surveyId, since);
    }

    /** Find a response by its edit token — for edit-after-submit (#40). */
    public java.util.Optional<SurveyResponse> findByEditToken(String editToken) {
        return find("editToken", editToken).firstResultOptional();
    }

    /** Responses submitted strictly before {@code cutoff} — for retention (#64). */
    public List<SurveyResponse> findOlderThan(String surveyId, Instant cutoff) {
        return list("surveyId = ?1 and submittedAt < ?2", surveyId, cutoff);
    }
}
