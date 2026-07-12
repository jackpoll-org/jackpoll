package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.AnalyticsCounter;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AnalyticsRepository implements PanacheRepositoryBase<AnalyticsCounter, String> {

    public List<AnalyticsCounter> findBySurvey(String surveyId) {
        return list("surveyId", surveyId);
    }

    public Optional<AnalyticsCounter> find(String surveyId, String dimension, String key) {
        return find("surveyId = ?1 and dimension = ?2 and key = ?3", surveyId, dimension, key)
            .firstResultOptional();
    }
}
