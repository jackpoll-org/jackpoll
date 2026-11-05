package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.ApiKey;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ApiKeyRepository implements PanacheRepositoryBase<ApiKey, String> {

    public List<ApiKey> findByUser(String userId) {
        return list("userId", Sort.descending("createdAt"), userId);
    }

    public Optional<ApiKey> findByHash(String keyHash) {
        return find("keyHash", keyHash).firstResultOptional();
    }

    public long countByUser(String userId) {
        return count("userId", userId);
    }
}
