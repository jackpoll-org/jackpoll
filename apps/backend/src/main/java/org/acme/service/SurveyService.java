package org.acme.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

import org.acme.dto.SurveyDtos.CreateSurveyRequest;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.CollaboratorRole;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.acme.entity.SurveySettings;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Business logic for surveys with role-based access (issue #8): the owner has
 * full control, editors can read & update, viewers can read. A survey a user
 * cannot access is treated as not found so we never leak its existence.
 */
@ApplicationScoped
public class SurveyService {

    @Inject
    SurveyRepository repository;

    @Inject
    CollaboratorRepository collaborators;

    @Inject
    org.acme.repository.ResponseRepository responses;

    @Inject
    SurveyMapper mapper;

    // ── Listing (owned + collaborated) ────────────────────────────

    public List<SurveyDto> list(String userId, int page, int limit) {
        var accessible = accessibleSurveys(userId);
        var from = Math.min(page * limit, accessible.size());
        var to = Math.min(from + limit, accessible.size());
        return accessible.subList(from, to).stream().map(mapper::toDto).toList();
    }

    public long count(String userId) {
        return accessibleSurveys(userId).size();
    }

    private List<Survey> accessibleSurveys(String userId) {
        var byId = new LinkedHashMap<String, Survey>();
        for (var s : repository.list("ownerId", userId)) {
            byId.put(s.id, s);
        }
        var collabIds = collaborators.findAcceptedByUser(userId).stream().map(c -> c.surveyId).toList();
        if (!collabIds.isEmpty()) {
            for (var s : repository.list("id in ?1", collabIds)) {
                byId.putIfAbsent(s.id, s);
            }
        }
        var all = new ArrayList<>(byId.values());
        all.sort(Comparator.comparing((Survey s) -> s.updatedAt).reversed());
        return all;
    }

    // ── Reads ─────────────────────────────────────────────────────

    public SurveyDto get(String userId, String id) {
        return mapper.toDto(requireReadable(userId, id));
    }

    /** Public read of a survey — only when published (for embedding/filling). */
    public SurveyDto getPublished(String id) {
        var survey = repository.findByIdOptional(id)
            .filter(s -> s.status == SurveyStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + id));
        SurveyAvailability.ensureOpen(survey, responses.countBySurvey(id));
        // Hide quiz correct answers from the public/embed payload.
        return mapper.toDto(survey, false);
    }

    // ── Mutations ─────────────────────────────────────────────────

    @Transactional
    public SurveyDto create(String ownerId, CreateSurveyRequest req) {
        var survey = new Survey();
        survey.id = UUID.randomUUID().toString();
        survey.ownerId = ownerId;
        survey.title = req.title();
        survey.description = req.description();
        survey.status = SurveyStatus.DRAFT;
        survey.settings = SurveySettings.defaults();
        repository.persist(survey);
        return mapper.toDto(survey);
    }

    @Transactional
    public SurveyDto update(String userId, String id, UpdateSurveyRequest req) {
        var survey = requireEditable(userId, id);
        // Drafts can be saved incomplete (untitled questions, empty options);
        // completeness is required only when publishing (#).
        if (req.status() == SurveyStatus.PUBLISHED) {
            ensurePublishable(req);
        }
        mapper.applyUpdate(survey, req);
        repository.persist(survey);
        return mapper.toDto(survey);
    }

    /** Reject a publish that still has blank question titles or option labels. */
    private void ensurePublishable(UpdateSurveyRequest req) {
        var questions = req.questions();
        if (questions == null) return;
        for (int i = 0; i < questions.size(); i++) {
            var q = questions.get(i);
            int n = i + 1;
            if (q.title() == null || q.title().isBlank()) {
                throw new org.acme.exception.SurveyIncompleteException(
                    "Question " + n + " needs a title before publishing.");
            }
            if (hasBlankLabel(q.options()) || hasBlankLabel(q.rows()) || hasBlankLabel(q.columns())) {
                throw new org.acme.exception.SurveyIncompleteException(
                    "Question " + n + " has an empty answer option — fill it in before publishing.");
            }
        }
    }

    private static boolean hasBlankLabel(java.util.List<org.acme.dto.SurveyDtos.OptionDto> opts) {
        if (opts == null) return false;
        return opts.stream().anyMatch(o -> o.label() == null || o.label().isBlank());
    }

    @Transactional
    public SurveyDto organize(String userId, String id, org.acme.dto.SurveyDtos.OrganizeRequest req) {
        var survey = requireEditable(userId, id);
        survey.tags = req.tags() != null ? req.tags() : new java.util.ArrayList<>();
        // Moving folders? Drop to the end of the destination bucket so the
        // manual order stays sensible (issue #94).
        if (!java.util.Objects.equals(survey.folderId, req.folderId())) {
            survey.sortPosition = nextPosition(survey.ownerId, req.folderId());
        }
        survey.folderId = req.folderId();
        repository.persist(survey);
        return mapper.toDto(survey);
    }

    /**
     * Persist a manual drag order for one owner+folder bucket (issue #94).
     * Only the owner's own surveys are repositioned; ids that aren't theirs or
     * aren't in the given folder are ignored so a stale client can't corrupt it.
     */
    @Transactional
    public void reorder(String ownerId, org.acme.dto.SurveyDtos.ReorderRequest req) {
        if (req.orderedIds() == null) return;
        double pos = 0;
        for (var id : req.orderedIds()) {
            var survey = repository.findByIdAndOwner(id, ownerId).orElse(null);
            if (survey == null || !java.util.Objects.equals(survey.folderId, req.folderId())) {
                continue;
            }
            survey.sortPosition = pos++;
            repository.persist(survey);
        }
    }

    /** One past the highest manual position in an owner's folder/root bucket. */
    private double nextPosition(String ownerId, String folderId) {
        var bucket = folderId == null
            ? repository.list("ownerId = ?1 and folderId is null", ownerId)
            : repository.list("ownerId = ?1 and folderId = ?2", ownerId, folderId);
        double max = -1;
        for (var s : bucket) {
            if (s.sortPosition != null && s.sortPosition > max) max = s.sortPosition;
        }
        return max + 1;
    }

    @Transactional
    public void delete(String ownerId, String id) {
        var survey = findOwnedOrThrow(ownerId, id);
        collaborators.delete("surveyId", id);
        repository.delete(survey);
    }

    // ── Access control (reused by other services/resources) ───────

    public Survey requireReadable(String userId, String id) {
        var survey = repository.findByIdOptional(id)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + id));
        if (isOwner(userId, survey) || roleOf(userId, survey) != null) {
            return survey;
        }
        throw new ResourceNotFoundException("Survey not found: " + id);
    }

    public Survey requireEditable(String userId, String id) {
        var survey = requireReadable(userId, id);
        if (isOwner(userId, survey) || roleOf(userId, survey) == CollaboratorRole.EDITOR) {
            return survey;
        }
        throw new ForbiddenAccessException("You don't have edit access to this survey.");
    }

    public Survey requireOwner(String userId, String id) {
        return findOwnedOrThrow(userId, id);
    }

    public boolean isOwner(String userId, Survey survey) {
        return survey.ownerId.equals(userId);
    }

    private CollaboratorRole roleOf(String userId, Survey survey) {
        // Only an accepted collaboration grants access; a pending invite does not.
        return collaborators.findBySurveyAndUser(survey.id, userId)
            .filter(c -> c.status == org.acme.entity.CollaboratorStatus.ACCEPTED)
            .map(c -> c.role)
            .orElse(null);
    }

    private Survey findOwnedOrThrow(String ownerId, String id) {
        return repository.findByIdAndOwner(id, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + id));
    }
}
