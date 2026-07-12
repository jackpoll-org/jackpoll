package org.acme.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

import org.acme.dto.AccessCodeDtos.AccessCodeDto;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.entity.AccessCode;
import org.acme.entity.SurveyStatus;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.AccessCodeRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Manages per-survey access codes and resolves them on entry (issue #15). */
@ApplicationScoped
public class AccessCodeService {

    // Unambiguous alphabet — no 0/O, 1/I/L.
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Inject
    SurveyService surveyService;

    @Inject
    SurveyRepository surveys;

    @Inject
    AccessCodeRepository codes;

    @Inject
    org.acme.repository.ResponseRepository responses;

    @Inject
    SurveyMapper mapper;

    @Transactional
    public AccessCodeDto get(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        return toDto(getOrCreate(surveyId));
    }

    @Transactional
    public AccessCodeDto rotate(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        var entity = getOrCreate(surveyId);
        entity.code = uniqueCode();
        entity.lastRotatedAt = Instant.now();
        return toDto(entity);
    }

    @Transactional
    public AccessCodeDto setRequireCode(String ownerId, String surveyId, boolean requireCode) {
        surveyService.requireOwner(ownerId, surveyId);
        var entity = getOrCreate(surveyId);
        entity.requireCode = requireCode;
        return toDto(entity);
    }

    /** Public: resolve an entered code to its published survey. */
    public SurveyDto resolve(String rawCode) {
        var normalized = normalize(rawCode);
        var entity = codes.findByCode(normalized)
            .orElseThrow(() -> new ResourceNotFoundException("Code not found."));
        var survey = surveys.findByIdOptional(entity.surveyId)
            .filter(s -> s.status == SurveyStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Code not found."));
        SurveyAvailability.ensureOpen(survey, responses.countBySurvey(entity.surveyId));
        return mapper.toDto(survey, false);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private static String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private AccessCode getOrCreate(String surveyId) {
        return codes.findBySurvey(surveyId).orElseGet(() -> {
            var entity = new AccessCode();
            entity.id = UUID.randomUUID().toString();
            entity.surveyId = surveyId;
            entity.code = uniqueCode();
            entity.requireCode = false;
            entity.lastRotatedAt = Instant.now();
            codes.persist(entity);
            return entity;
        });
    }

    private AccessCodeDto toDto(AccessCode entity) {
        return new AccessCodeDto(
            entity.code,
            entity.requireCode,
            entity.lastRotatedAt != null ? entity.lastRotatedAt.toString() : null);
    }

    private String uniqueCode() {
        String code;
        do {
            var sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            code = sb.toString();
        } while (codes.codeExists(code));
        return code;
    }
}
