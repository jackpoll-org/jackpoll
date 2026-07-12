package org.acme.repository;

import java.util.Optional;

import org.acme.entity.AccessCode;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AccessCodeRepository implements PanacheRepositoryBase<AccessCode, String> {

    public Optional<AccessCode> findBySurvey(String surveyId) {
        return find("surveyId", surveyId).firstResultOptional();
    }

    public Optional<AccessCode> findByCode(String normalizedCode) {
        return find("code", normalizedCode).firstResultOptional();
    }

    public boolean codeExists(String normalizedCode) {
        return count("code", normalizedCode) > 0;
    }
}
