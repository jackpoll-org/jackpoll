package org.acme.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

import org.acme.dto.CollabLinkDtos.CollabLinkDto;
import org.acme.dto.CollabLinkDtos.UpdateCollabLinkRequest;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.CollabLink;
import org.acme.entity.Survey;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.CollabLinkRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Passwordless survey-editing links (issue #22). */
@ApplicationScoped
public class CollabLinkService {

    private static final String ALPHABET =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int SLUG_LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Inject
    SurveyService surveyService;

    @Inject
    SurveyRepository surveys;

    @Inject
    CollabLinkRepository links;

    @Inject
    SurveyMapper mapper;

    // ── Owner ─────────────────────────────────────────────────────

    /** The current link, or an empty DTO when none exists — links are only created on request. */
    public CollabLinkDto get(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        return links.findBySurvey(surveyId).map(this::toDto).orElse(new CollabLinkDto(null, null));
    }

    @Transactional
    public void disable(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        links.findBySurvey(surveyId).ifPresent(links::delete);
    }

    @Transactional
    public CollabLinkDto rotate(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        var link = getOrCreate(surveyId);
        link.slug = uniqueSlug();
        return toDto(link);
    }

    @Transactional
    public CollabLinkDto update(String ownerId, String surveyId, UpdateCollabLinkRequest req) {
        surveyService.requireOwner(ownerId, surveyId);
        var expiresAt = req.expiresAt() == null || req.expiresAt().isBlank() ? null : req.expiresAt();
        if (expiresAt != null) {
            try {
                Instant.parse(expiresAt);
            } catch (java.time.format.DateTimeParseException e) {
                throw new IllegalArgumentException("Invalid expiry date.");
            }
        }
        var link = getOrCreate(surveyId);
        link.expiresAt = expiresAt;
        return toDto(link);
    }

    // ── Public (link holder) ──────────────────────────────────────

    /** Resolve the link to its survey for editing (full payload incl. answers). */
    public SurveyDto resolve(String slug) {
        return mapper.toDto(requireValidLinkSurvey(slug), true);
    }

    @Transactional
    public SurveyDto applyEdit(String slug, UpdateSurveyRequest req) {
        var survey = requireValidLinkSurvey(slug);
        mapper.applyUpdate(survey, req);
        surveys.persist(survey);
        return mapper.toDto(survey, true);
    }

    /** The survey a valid, unexpired edit link belongs to, or null. */
    public String validSurveyId(String slug) {
        try {
            return requireValidLinkSurvey(slug).id;
        } catch (ResourceNotFoundException | ForbiddenAccessException e) {
            return null;
        }
    }

    private Survey requireValidLinkSurvey(String slug) {
        var link = links.findBySlug(slug)
            .orElseThrow(() -> new ResourceNotFoundException("Link not found."));
        ensureValid(link);
        return surveys.findByIdOptional(link.surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Link not found."));
    }

    private void ensureValid(CollabLink link) {
        if (link.expiresAt != null && !link.expiresAt.isBlank()) {
            Instant expiry;
            try {
                expiry = Instant.parse(link.expiresAt);
            } catch (java.time.format.DateTimeParseException e) {
                expiry = Instant.EPOCH;
            }
            if (Instant.now().isAfter(expiry)) {
                throw new ForbiddenAccessException("This collaboration link has expired.");
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private CollabLink getOrCreate(String surveyId) {
        return links.findBySurvey(surveyId).orElseGet(() -> {
            var link = new CollabLink();
            link.id = UUID.randomUUID().toString();
            link.surveyId = surveyId;
            link.slug = uniqueSlug();
            links.persist(link);
            return link;
        });
    }

    private CollabLinkDto toDto(CollabLink link) {
        return new CollabLinkDto(link.slug, link.expiresAt);
    }

    private String uniqueSlug() {
        String slug;
        do {
            var sb = new StringBuilder(SLUG_LENGTH);
            for (int i = 0; i < SLUG_LENGTH; i++) {
                sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            slug = sb.toString();
        } while (links.slugExists(slug));
        return slug;
    }
}
