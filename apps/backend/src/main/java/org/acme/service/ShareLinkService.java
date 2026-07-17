package org.acme.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;

import org.acme.dto.ShareLinkDtos.ShareLinkDto;
import org.acme.dto.ShareLinkDtos.UpdateShareLinkRequest;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.entity.ShareLink;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.ResponseRepository;
import org.acme.repository.ShareLinkRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Manages the canonical shareable link per survey (issue #16). */
@ApplicationScoped
public class ShareLinkService {

    private static final String ALPHABET =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int SLUG_LENGTH = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    @Inject
    SurveyService surveyService;

    @Inject
    SurveyRepository surveys;

    @Inject
    ShareLinkRepository links;

    @Inject
    ResponseRepository responses;

    @Inject
    SurveyMapper mapper;

    // ── Owner operations ──────────────────────────────────────────

    @Transactional
    public ShareLinkDto get(String ownerId, String surveyId) {
        surveyService.requireEditable(ownerId, surveyId);
        return toDto(getOrCreate(surveyId));
    }

    @Transactional
    public ShareLinkDto rotate(String ownerId, String surveyId) {
        surveyService.requireEditable(ownerId, surveyId);
        var link = getOrCreate(surveyId);
        link.slug = uniqueSlug();
        return toDto(link);
    }

    @Transactional
    public ShareLinkDto update(String ownerId, String surveyId, UpdateShareLinkRequest req) {
        surveyService.requireEditable(ownerId, surveyId);
        var link = getOrCreate(surveyId);
        link.expiresAt = req.expiresAt();
        link.maxResponses = req.maxResponses();
        return toDto(link);
    }

    // ── Public resolve ────────────────────────────────────────────

    public SurveyDto resolve(String slug) {
        var link = links.findBySlug(slug)
            .orElseThrow(() -> new ResourceNotFoundException("Link not found."));
        var survey = surveys.findByIdOptional(link.surveyId)
            .filter(s -> s.status == SurveyStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Link not found."));
        SurveyAvailability.ensureOpen(survey, responses.countBySurvey(link.surveyId));
        ensureLinkOpen(link);
        return mapper.toDto(survey, false);
    }

    /** Enforced on submission too (called by {@link ResponseService}). */
    public void ensureSurveyAcceptingResponses(String surveyId) {
        links.findBySurvey(surveyId).ifPresent(this::ensureLinkOpen);
    }

    private void ensureLinkOpen(ShareLink link) {
        if (link.expiresAt != null && !link.expiresAt.isBlank()) {
            try {
                if (Instant.now().isAfter(Instant.parse(link.expiresAt))) {
                    throw new ForbiddenAccessException("This link has expired.");
                }
            } catch (java.time.format.DateTimeParseException ignored) {
                // malformed → no date limit
            }
        }
        if (link.maxResponses != null
            && responses.countBySurvey(link.surveyId) >= link.maxResponses) {
            throw new ForbiddenAccessException("This survey is no longer accepting responses.");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private ShareLink getOrCreate(String surveyId) {
        return links.findBySurvey(surveyId).orElseGet(() -> {
            var link = new ShareLink();
            link.id = UUID.randomUUID().toString();
            link.surveyId = surveyId;
            link.slug = uniqueSlug();
            links.persist(link);
            return link;
        });
    }

    private ShareLinkDto toDto(ShareLink link) {
        return new ShareLinkDto(
            link.slug,
            link.expiresAt,
            link.maxResponses,
            responses.countBySurvey(link.surveyId));
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
