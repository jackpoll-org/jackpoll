package org.acme.security;

import java.util.Objects;
import java.util.Set;

import org.acme.dto.SurveyDtos.SurveySettingsDto;
import org.acme.exception.ForbiddenAccessException;
import org.acme.repository.ResponseRepository;
import org.acme.service.ApiKeyService;
import org.acme.service.SurveyService;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;

@RequestScoped
public class ApiKeyGuard {

    @Inject
    SecurityIdentity identity;

    @Inject
    SurveyService surveyService;

    @Inject
    ResponseRepository responses;

    public void checkUpdate(String userId, String surveyId, SurveySettingsDto next) {
        if (!lacksResponseAccess() || next == null) return;
        var current = surveyService.requireEditable(userId, surveyId).settings;
        if (current == null) return;
        boolean exposesOrPurges = next.showLiveResults() != current.showLiveResults
            || next.postSubmitSummary() != current.postSubmitSummary
            || next.studentResults() != current.studentResults
            || next.resultsReleased() != current.resultsReleased
            || !Objects.equals(next.retentionDays(), current.retentionDays)
            || next.retentionAnonymize() != current.retentionAnonymize;
        if (exposesOrPurges) {
            throw new ForbiddenAccessException(
                "This API key can't change result sharing or data retention. Allow it to read responses first.");
        }
    }

    public void checkDelete(String userId, String surveyId) {
        if (!lacksResponseAccess()) return;
        surveyService.requireOwner(userId, surveyId);
        if (responses.countBySurvey(surveyId) > 0) {
            throw new ForbiddenAccessException(
                "This API key can't delete a survey that has responses. Allow it to read responses first.");
        }
    }

    private boolean lacksResponseAccess() {
        Set<String> scopes = identity.getAttribute(ApiKeyIdentityProvider.SCOPES_ATTRIBUTE);
        return scopes != null && !scopes.contains(ApiKeyService.SCOPE_RESPONSES);
    }
}
