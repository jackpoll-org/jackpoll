package org.acme.repository;

import java.time.Instant;
import java.util.List;

import org.acme.entity.RespondentToken;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class RespondentTokenRepository implements PanacheRepositoryBase<RespondentToken, String> {

    public List<RespondentToken> findBySurvey(String surveyId) {
        return list("surveyId", Sort.by("createdAt").and("token"), surveyId);
    }

    public boolean exists(String surveyId, String token) {
        return count("surveyId = ?1 and token = ?2", surveyId, token) > 0;
    }

    public boolean consume(String surveyId, String token, Instant now) {
        return update("usedAt = ?1 where surveyId = ?2 and token = ?3 and usedAt is null",
            now, surveyId, token) == 1;
    }

    public boolean consumeForSession(String surveyId, String token, String sessionId, Instant now) {
        return update("usedAt = coalesce(usedAt, ?1), sessionId = ?2"
                + " where surveyId = ?3 and token = ?4 and (usedAt is null or sessionId = ?2)",
            now, sessionId, surveyId, token) == 1;
    }

    public long releaseAll(String surveyId) {
        return update("usedAt = null, sessionId = null where surveyId = ?1", surveyId);
    }
}
