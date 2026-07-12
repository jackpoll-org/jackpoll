package org.acme.repository;

import java.util.Optional;

import org.acme.entity.ShareLink;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ShareLinkRepository implements PanacheRepositoryBase<ShareLink, String> {

    public Optional<ShareLink> findBySurvey(String surveyId) {
        return find("surveyId", surveyId).firstResultOptional();
    }

    public Optional<ShareLink> findBySlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }

    public boolean slugExists(String slug) {
        return count("slug", slug) > 0;
    }
}
