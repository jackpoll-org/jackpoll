package org.acme.repository;

import java.util.Optional;

import org.acme.entity.CollabLink;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class CollabLinkRepository implements PanacheRepositoryBase<CollabLink, String> {

    public Optional<CollabLink> findBySurvey(String surveyId) {
        return find("surveyId", surveyId).firstResultOptional();
    }

    public Optional<CollabLink> findBySlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }

    public boolean slugExists(String slug) {
        return count("slug", slug) > 0;
    }
}
