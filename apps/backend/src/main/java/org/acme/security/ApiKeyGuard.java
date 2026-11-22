package org.acme.security;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.acme.dto.SurveyDtos.QuestionDto;
import org.acme.dto.SurveyDtos.SurveySettingsDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.Question;
import org.acme.entity.SurveySettings;
import org.acme.exception.ForbiddenAccessException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.ResponseRepository;
import org.acme.service.ApiKeyService;
import org.acme.service.LiveExposure;
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

    @Inject
    SurveyMapper mapper;

    public void checkUpdate(String userId, String surveyId, UpdateSurveyRequest req) {
        if (!lacksResponseAccess()) return;
        var survey = surveyService.requireEditable(userId, surveyId);
        if (changesSettingsSharing(req.settings(), survey.settings)
            || changesQuestionSharing(survey.questions, req.questions())
            || widensQuestionExposure(survey.questions, survey.settings, req)) {
            throw new ForbiddenAccessException(
                "This API key can't change result sharing or data retention. Allow it to read responses first.");
        }
    }

    private static boolean changesSettingsSharing(SurveySettingsDto next, SurveySettings current) {
        if (next == null || current == null) return false;
        return next.showLiveResults() != current.showLiveResults
            || next.postSubmitSummary() != current.postSubmitSummary
            || next.postSubmitCombinedWordcloud() != current.postSubmitCombinedWordcloud
            || next.studentResults() != current.studentResults
            || next.resultsReleased() != current.resultsReleased
            || !Objects.equals(next.retentionDays(), current.retentionDays)
            || next.retentionAnonymize() != current.retentionAnonymize
            || (next.isQuiz() && next.doNotStoreResponses()) == current.storesResponses()
            || SurveySettings.REVEAL_ANSWER_KEY.equals(next.showCorrectAnswers()) != SurveySettings.revealsAnswerKey(current);
    }

    private static boolean changesQuestionSharing(List<Question> current, List<QuestionDto> next) {
        if (next == null) return false;
        Map<String, Question> byId = current == null ? Map.of()
            : current.stream().collect(Collectors.toMap(q -> q.id, Function.identity(), (a, b) -> a));
        return next.stream().anyMatch(q -> {
            var old = q.id() == null ? null : byId.get(q.id());
            boolean cloud = isWordcloudChart(q.settings());
            if (old == null) return cloud;
            return cloud != isWordcloudChart(old.settings)
                || Boolean.FALSE.equals(q.showInLiveResults()) != Boolean.FALSE.equals(old.showInLiveResults);
        });
    }

    private boolean widensQuestionExposure(List<Question> current, SurveySettings settings, UpdateSurveyRequest req) {
        if (req.questions() == null || current == null) return false;
        boolean quizBefore = settings != null && settings.isQuiz;
        boolean quizAfter = req.settings() == null ? quizBefore : req.settings().isQuiz();
        Map<String, Question> byId = current.stream().collect(Collectors.toMap(q -> q.id, Function.identity(), (a, b) -> a));
        return req.questions().stream().anyMatch(d -> {
            var old = d.id() == null ? null : byId.get(d.id());
            return old != null && LiveExposure.widens(quizBefore, old, quizAfter, mapper.previewQuestion(d));
        });
    }

    private static boolean isWordcloudChart(Map<String, Object> settings) {
        return settings != null && "wordcloud".equals(settings.get("resultChart"));
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
