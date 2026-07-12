package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.Template;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class TemplateRepository implements PanacheRepositoryBase<Template, String> {

    public List<Template> findByOwner(String ownerId) {
        return list("ownerId", Sort.by("updatedAt").descending(), ownerId);
    }

    public Optional<Template> findByIdAndOwner(String id, String ownerId) {
        return find("id = ?1 and ownerId = ?2", id, ownerId).firstResultOptional();
    }
}
