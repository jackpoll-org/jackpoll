package org.acme.repository;

import java.time.Instant;
import java.util.List;

import org.acme.entity.LiveSession;
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

    /** Live leaderboard rows for one session: [trimmed name, total score] per player, best first.
     *  Responses that answer any of {@code hiddenQuestionIds} are left out. */
    public List<Object[]> leaderboard(
            String surveyId, String sessionId, java.util.Collection<String> hiddenQuestionIds, int limit) {
        var query = getEntityManager().createQuery(
                "select trim(r.respondentName), coalesce(sum(r.score), 0) from SurveyResponse r"
                    + " where r.surveyId = ?1 and r.sessionId = ?2 and r.preview = false"
                    + (hiddenQuestionIds.isEmpty() ? ""
                        : " and not exists (select a.id from ResponseAnswer a where a.response = r"
                            + " and a.questionId in ?3)")
                    + " and r.respondentName is not null and trim(r.respondentName) <> ''"
                    + " group by r.clientId, trim(r.respondentName)"
                    + " order by coalesce(sum(r.score), 0) desc, trim(r.respondentName) asc",
                Object[].class)
            .setParameter(1, surveyId)
            .setParameter(2, sessionId);
        if (!hiddenQuestionIds.isEmpty()) query.setParameter(3, hiddenQuestionIds);
        return query.setMaxResults(limit).getResultList();
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

    public Instant firstSubmissionWithoutSession(String surveyId) {
        return getEntityManager().createQuery(
                "select min(r.submittedAt) from SurveyResponse r"
                    + " where r.surveyId = ?1 and r.sessionId is null and r.preview = false", Instant.class)
            .setParameter(1, surveyId)
            .getSingleResult();
    }

    public void moveUnassignedAndReleaseQuotas(String surveyId, String sessionId) {
        getEntityManager().createNativeQuery(
                "with moved as (update survey_responses set session_id = ?2"
                    + " where survey_id = ?1 and session_id is null and preview = false returning id),"
                    + " freed as (select a.value #>> '{}' as option_id, count(*) as n from response_answers a"
                    + " join moved m on m.id = a.response_id group by 1)"
                    + " update question_options o set used = greatest(o.used - f.n, 0)"
                    + " from freed f, questions q"
                    + " where o.id = f.option_id and q.id = o.question_id and q.survey_id = ?1"
                    + " and o.capacity is not null and o.kind = 'OPTION'"
                    + " and q.type in ('MULTIPLE_CHOICE', 'DROPDOWN')")
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .executeUpdate();
    }

    public List<String> surveysWithRunsAndUnassignedResponses() {
        return getEntityManager().createQuery(
                "select distinct r.surveyId from SurveyResponse r where r.sessionId is null and r.preview = false"
                    + " and exists (select 1 from LiveSession s where s.surveyId = r.surveyId and s.kind = ?1)",
                String.class)
            .setParameter(1, LiveSession.SCHEDULED)
            .getResultList();
    }

    public long countBySession(String surveyId, String sessionId) {
        return count("surveyId = ?1 and sessionId = ?2 and preview = false", surveyId, sessionId);
    }

    public java.util.Map<String, Long> optionUsageInSession(String surveyId, String sessionId, String excludeResponseId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = getEntityManager().createNativeQuery(
                "select a.value #>> '{}', count(*) from response_answers a"
                    + " join survey_responses r on r.id = a.response_id"
                    + " where r.survey_id = ?1 and r.session_id = ?2 and r.preview = false and r.id <> ?3"
                    + " and jsonb_typeof(a.value) = 'string' group by 1")
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .setParameter(3, excludeResponseId != null ? excludeResponseId : "")
            .getResultList();
        var usage = new java.util.HashMap<String, Long>();
        for (var row : rows) usage.put((String) row[0], ((Number) row[1]).longValue());
        return usage;
    }

    public boolean existsByClientIdInSession(String surveyId, String sessionId, String clientId) {
        return count("surveyId = ?1 and sessionId = ?2 and clientId = ?3", surveyId, sessionId, clientId) > 0;
    }

    /** Whether a given browser (hashed client id) already responded (#31). */
    public boolean existsByClientId(String surveyId, String clientId) {
        return count("surveyId = ?1 and clientId = ?2", surveyId, clientId) > 0;
    }

    public void lockPlayer(String sessionId, String clientId) {
        getEntityManager().createNativeQuery("select 1 from (select pg_advisory_xact_lock(hashtext(?1))) l")
            .setParameter(1, sessionId + "|" + clientId)
            .getSingleResult();
    }

    /** Like {@link #lockPlayer}, but gives up after a few seconds instead of holding a pooled connection. */
    public void lockOrThrottle(String key) {
        var em = getEntityManager();
        em.createNativeQuery("set local lock_timeout = '3s'").executeUpdate();
        try {
            em.createNativeQuery("select 1 from (select pg_advisory_xact_lock(hashtext(?1))) l")
                .setParameter(1, key)
                .getSingleResult();
        } catch (jakarta.persistence.PersistenceException e) {
            if (!lockNotAvailable(e)) throw e;
            throw new org.acme.exception.RateLimitedException("Too many submissions right now. Please try again.");
        }
        em.createNativeQuery("set local lock_timeout to default").executeUpdate();
    }

    private static boolean lockNotAvailable(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException sql && "55P03".equals(sql.getSQLState())) return true;
        }
        return false;
    }

    public boolean playerAnswered(
            String surveyId, String sessionId, String clientId, java.util.Collection<String> questionIds) {
        if (questionIds.isEmpty()) return false;
        return getEntityManager().createQuery(
                "select count(a) from ResponseAnswer a where a.response.surveyId = ?1"
                    + " and a.response.sessionId = ?2 and a.response.clientId = ?3"
                    + " and a.questionId in ?4", Long.class)
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .setParameter(3, clientId)
            .setParameter(4, questionIds)
            .getSingleResult() > 0;
    }

    public Integer playerScore(String surveyId, String sessionId, String clientId, String questionId) {
        return getEntityManager().createQuery(
                "select r.score from ResponseAnswer a join a.response r where r.surveyId = ?1"
                    + " and r.sessionId = ?2 and r.clientId = ?3 and r.preview = false"
                    + " and a.questionId = ?4", Integer.class)
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .setParameter(3, clientId)
            .setParameter(4, questionId)
            .setMaxResults(1)
            .getResultStream()
            .findFirst()
            .orElse(null);
    }

    public boolean tokenAnswered(
            String surveyId, String sessionId, String token, java.util.Collection<String> questionIds) {
        if (questionIds.isEmpty()) return false;
        return getEntityManager().createQuery(
                "select count(a) from ResponseAnswer a where a.response.surveyId = ?1"
                    + " and a.response.sessionId = ?2 and a.response.respondentToken = ?3"
                    + " and a.questionId in ?4", Long.class)
            .setParameter(1, surveyId)
            .setParameter(2, sessionId)
            .setParameter(3, token)
            .setParameter(4, questionIds)
            .getSingleResult() > 0;
    }

    /** Count responses submitted at/after an instant — for digests (#24). */
    public long countBySurveySince(String surveyId, Instant since) {
        return count("surveyId = ?1 and submittedAt >= ?2", surveyId, since);
    }

    /** Find a response by its edit token — for edit-after-submit (#40). */
    public java.util.Optional<SurveyResponse> findByResultCode(String surveyId, String resultCode) {
        return find("surveyId = ?1 and resultCode = ?2 and preview = false", surveyId, resultCode)
            .firstResultOptional();
    }

    public java.util.Optional<SurveyResponse> findByEditToken(String editToken) {
        return find("editToken", editToken).firstResultOptional();
    }

    /** Responses submitted strictly before {@code cutoff} — for retention (#64). */
    public List<SurveyResponse> findOlderThan(String surveyId, Instant cutoff) {
        return list("surveyId = ?1 and submittedAt < ?2", surveyId, cutoff);
    }
}
