package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.Folder;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class FolderRepository implements PanacheRepositoryBase<Folder, String> {

    public List<Folder> findByOwner(String ownerId) {
        return list("ownerId", Sort.by("name"), ownerId);
    }

    public Optional<Folder> findByIdAndOwner(String id, String ownerId) {
        return find("id = ?1 and ownerId = ?2", id, ownerId).firstResultOptional();
    }
}
