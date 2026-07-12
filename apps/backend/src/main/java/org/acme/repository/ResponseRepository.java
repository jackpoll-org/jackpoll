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
