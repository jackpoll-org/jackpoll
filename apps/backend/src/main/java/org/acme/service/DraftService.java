package org.acme.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.acme.dto.DraftDtos.DraftDto;
import org.acme.dto.DraftDtos.SaveDraftRequest;
import org.acme.entity.ResponseDraft;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.ResponseDraftRepository;
import org.acme.repository.SurveyRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Anonymous save &amp; resume drafts (issue #26). Drafts are stored server-side
 * for cross-device resume, keyed by an unguessable token, and expire after a
 * configurable period. They never count as submissions.
 */
@ApplicationScoped
public class DraftService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int TOKEN_LENGTH = 40;

    @Inject
    ResponseDraftRepository drafts;

    @Inject
    SurveyRepository surveys;

    @ConfigProperty(name = "survey.draft.ttl-days", defaultValue = "30")
    long ttlDays;

    /** Create a new draft or update an existing one identified by its token. */
    @Transactional
    public DraftDto save(String surveyId, SaveDraftRequest req) {
        surveys.findByIdOptional(surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));

        var now = Instant.now();
        ResponseDraft draft = null;
        if (req.token() != null && !req.token().isBlank()) {
            draft = drafts.findByToken(req.token())
                .filter(d -> d.surveyId.equals(surveyId))
                .orElse(null);
        }

        boolean isNew = draft == null;
        if (isNew) {
            draft = new ResponseDraft();
            draft.id = UUID.randomUUID().toString();
            draft.token = uniqueToken();
            draft.surveyId = surveyId;
            draft.createdAt = now;
        }

        draft.answers = req.answers();
        draft.position = req.position();
        draft.updatedAt = now;
        draft.expiresAt = now.plus(ttlDays, ChronoUnit.DAYS);

        // Persist only after all non-null fields are set (assigned id inserts eagerly).
        if (isNew) {
            drafts.persist(draft);
        }
        return toDto(draft);
    }

    /** Restore a draft by token; rejects unknown or expired drafts. */
    public DraftDto get(String token) {
        var draft = drafts.findByToken(token)
            .orElseThrow(() -> new ResourceNotFoundException("Draft not found"));
        if (draft.expiresAt.isBefore(Instant.now())) {
            throw new ResourceNotFoundException("Draft has expired");
        }
        return toDto(draft);
    }

    /** Discard a draft (e.g. after a successful submission). Idempotent. */
    @Transactional
    public void delete(String token) {
        drafts.findByToken(token).ifPresent(drafts::delete);
    }

    private String uniqueToken() {
        String token;
        do {
            var sb = new StringBuilder(TOKEN_LENGTH);
            for (int i = 0; i < TOKEN_LENGTH; i++) {
                sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            token = sb.toString();
        } while (drafts.tokenExists(token));
        return token;
    }

    private DraftDto toDto(ResponseDraft d) {
        return new DraftDto(d.token, d.surveyId, d.answers, d.position, d.expiresAt);
    }
}
