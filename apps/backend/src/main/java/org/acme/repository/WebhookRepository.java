package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.Webhook;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

/** Data access for survey webhooks (issue #36). */
@ApplicationScoped
public class WebhookRepository implements PanacheRepositoryBase<Webhook, String> {

    public List<Webhook> findBySurvey(String surveyId) {
        return list("surveyId", Sort.by("createdAt"), surveyId);
    }

    public List<Webhook> findEnabledBySurvey(String surveyId) {
        return list("surveyId = ?1 and enabled = true", surveyId);
    }

    public Optional<Webhook> findByIdAndSurvey(String id, String surveyId) {
        return find("id = ?1 and surveyId = ?2", id, surveyId).firstResultOptional();
    }
}
