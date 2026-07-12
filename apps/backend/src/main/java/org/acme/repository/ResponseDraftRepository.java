package org.acme.repository;

import java.util.Optional;

import org.acme.entity.ResponseDraft;

import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

/** Data access for anonymous save &amp; resume drafts (issue #26). */
@ApplicationScoped
public class ResponseDraftRepository implements PanacheRepository<ResponseDraft> {

    public Optional<ResponseDraft> findByToken(String token) {
        return find("token", token).firstResultOptional();
    }

    public boolean tokenExists(String token) {
        return count("token", token) > 0;
    }
}
