package org.acme.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

import org.acme.dto.RespondentTokenDtos.RespondentTokenDto;
import org.acme.entity.RespondentToken;
import org.acme.entity.Survey;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.RateLimitedException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.exception.SurveyIncompleteException;
import org.acme.repository.RespondentTokenRepository;
import org.acme.repository.ResponseRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class RespondentTokenService {

    static final int MAX_TOKENS_PER_SURVEY = 10000;
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int TOKEN_LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Inject
    SurveyService surveyService;

    @Inject
    RespondentTokenRepository tokens;

    @Inject
    ResponseRepository responses;

    @Inject
    RateLimiterService rateLimiter;

    @ConfigProperty(name = "survey.respondent-token.rate-limit.max", defaultValue = "600")
    int rateLimitMax;

    @ConfigProperty(name = "survey.respondent-token.rate-limit.window-seconds", defaultValue = "60")
    long rateLimitWindowSeconds;

    public List<RespondentTokenDto> list(String userId, String surveyId) {
        surveyService.requireEditable(userId, surveyId);
        return tokens.findBySurvey(surveyId).stream().map(RespondentTokenService::toDto).toList();
    }

    @Transactional
    public List<RespondentTokenDto> generate(String userId, String surveyId, int count) {
        surveyService.requireEditable(userId, surveyId);
        var existing = existingTokens(surveyId);
        var fresh = new LinkedHashSet<String>();
        while (fresh.size() < count) {
            var token = randomToken();
            if (!existing.contains(token)) fresh.add(token);
        }
        return persist(surveyId, existing.size(), fresh);
    }

    @Transactional
    public List<RespondentTokenDto> add(String userId, String surveyId, List<String> values) {
        surveyService.requireEditable(userId, surveyId);
        var existing = existingTokens(surveyId);
        var fresh = new LinkedHashSet<String>();
        for (var value : values) {
            var token = value.trim();
            if (!existing.contains(token)) fresh.add(token);
        }
        return persist(surveyId, existing.size(), fresh);
    }

    @Transactional
    public void delete(String userId, String surveyId, String tokenId) {
        surveyService.requireEditable(userId, surveyId);
        var entity = tokens.findByIdOptional(tokenId)
            .filter(t -> surveyId.equals(t.surveyId))
            .orElseThrow(() -> new ResourceNotFoundException("Token not found."));
        tokens.delete(entity);
    }

    @Transactional
    public void deleteAll(String userId, String surveyId) {
        surveyService.requireEditable(userId, surveyId);
        tokens.delete("surveyId", surveyId);
    }

    public String redeem(
            Survey survey, String sessionId, String rawToken,
            Collection<String> questionIds, String clientIp) {
        var token = rawToken == null ? "" : rawToken.trim();
        if (token.isEmpty()) {
            throw new SurveyIncompleteException("Please enter your token before submitting.");
        }
        var key = "respondent-token|" + survey.id + "|" + (clientIp == null ? "unknown" : clientIp);
        if (!rateLimiter.allow(key, rateLimitMax, rateLimitWindowSeconds)) {
            throw new RateLimitedException("Too many attempts. Please wait a moment and try again.");
        }
        var now = Instant.now();
        boolean live = survey.settings.liveMode && sessionId != null;
        boolean redeemed = live
            ? tokens.consumeForSession(survey.id, token, sessionId, now)
            : tokens.consume(survey.id, token, now);
        if (!redeemed) {
            throw new ForbiddenAccessException(tokens.exists(survey.id, token)
                ? "This token has already been used."
                : "This token is not valid.");
        }
        if (live && responses.tokenAnswered(survey.id, sessionId, token, questionIds)) {
            throw new ForbiddenAccessException("This token has already answered this question.");
        }
        return token;
    }

    private HashSet<String> existingTokens(String surveyId) {
        var existing = new HashSet<String>();
        for (var t : tokens.findBySurvey(surveyId)) existing.add(t.token);
        return existing;
    }

    private List<RespondentTokenDto> persist(String surveyId, int existingCount, Collection<String> fresh) {
        if (existingCount + fresh.size() > MAX_TOKENS_PER_SURVEY) {
            throw new IllegalArgumentException("A survey can have at most 10000 tokens.");
        }
        var now = Instant.now();
        for (var value : fresh) {
            var entity = new RespondentToken();
            entity.id = UUID.randomUUID().toString();
            entity.surveyId = surveyId;
            entity.token = value;
            entity.createdAt = now;
            tokens.persist(entity);
        }
        return tokens.findBySurvey(surveyId).stream().map(RespondentTokenService::toDto).toList();
    }

    private static String randomToken() {
        var sb = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    private static RespondentTokenDto toDto(RespondentToken t) {
        return new RespondentTokenDto(
            t.id,
            t.token,
            t.usedAt != null ? t.usedAt.toString() : null,
            t.createdAt.toString());
    }
}
