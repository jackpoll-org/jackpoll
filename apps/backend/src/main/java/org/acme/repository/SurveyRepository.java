package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.Survey;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class SurveyRepository implements PanacheRepositoryBase<Survey, String> {

    public List<Survey> findByOwner(String ownerId, int page, int limit) {
        return find("ownerId", Sort.by("updatedAt").descending(), ownerId)
            .page(Page.of(page, limit))
            .list();
    }

    public long countByOwner(String ownerId) {
        return count("ownerId", ownerId);
    }

    public Optional<Survey> findByIdAndOwner(String id, String ownerId) {
        return find("id = ?1 and ownerId = ?2", id, ownerId).firstResultOptional();
    }
}
