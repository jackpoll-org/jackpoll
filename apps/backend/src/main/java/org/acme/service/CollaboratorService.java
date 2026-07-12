package org.acme.service;

import java.util.List;
import java.util.UUID;

import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.dto.CollaboratorDtos.CollaboratorDto;
import org.acme.dto.CollaboratorDtos.InvitationDto;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.SurveyCollaborator;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Manages survey collaborators (issue #8). Only the owner may add/remove. */
@ApplicationScoped
public class CollaboratorService {

    @Inject
    SurveyService surveyService;

    @Inject
    CollaboratorRepository collaborators;

    @Inject
    UserRepository users;

    @Inject
    SurveyRepository surveys;

    @Inject
    PushService pushService;

    public List<CollaboratorDto> list(String requesterId, String surveyId) {
        surveyService.requireReadable(requesterId, surveyId);
        return collaborators.findBySurvey(surveyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public CollaboratorDto add(String ownerId, String surveyId, AddCollaboratorRequest req) {
        var survey = surveyService.requireOwner(ownerId, surveyId);

        var user = users.findByEmail(req.email())
            .orElseThrow(() -> new ResourceNotFoundException(
                "No user with email " + req.email() + ". They must register first."));

        if (user.id.equals(ownerId)) {
            throw new ForbiddenAccessException("You already own this survey.");
        }

        var existing = collaborators.findBySurveyAndUser(surveyId, user.id).orElse(null);
        if (existing != null) {
            // Re-inviting just updates the role; keep the existing accept state.
            existing.role = req.role();
            return toDto(existing);
        }

        var collaborator = new SurveyCollaborator();
        collaborator.id = UUID.randomUUID().toString();
        collaborator.surveyId = surveyId;
        collaborator.userId = user.id;
        collaborator.role = req.role();
        collaborator.status = CollaboratorStatus.PENDING;
        collaborators.persist(collaborator);

        // Notify the invitee on their devices (best-effort) so they can accept
        // the invitation in the app.
        var owner = users.findByIdOptional(ownerId).orElse(null);
        var ownerName = owner != null && owner.name != null ? owner.name : "Someone";
        pushService.notifyUser(
            user.id,
            "Collaboration invite",
            ownerName + " invited you to collaborate on \"" + survey.title + "\".");

        return toDto(collaborator);
    }

    @Transactional
    public void remove(String ownerId, String surveyId, String userId) {
        surveyService.requireOwner(ownerId, surveyId);
        collaborators.deleteBySurveyAndUser(surveyId, userId);
    }

    // ── Invitee-facing (#8) ───────────────────────────────────────

    /** Pending invitations awaiting this user's acceptance. */
    public List<InvitationDto> invitations(String userId) {
        return collaborators.findPendingByUser(userId).stream()
            .map(c -> {
                var survey = surveys.findByIdOptional(c.surveyId).orElse(null);
                if (survey == null) return null;
                var owner = users.findByIdOptional(survey.ownerId).orElse(null);
                return new InvitationDto(
                    c.surveyId,
                    survey.title,
                    owner != null ? owner.name : null,
                    c.role);
            })
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    /** Accept a pending invitation, granting access to the survey. */
    @Transactional
    public void accept(String userId, String surveyId) {
        var invite = collaborators.findBySurveyAndUser(surveyId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("No invitation for this survey."));
        invite.status = CollaboratorStatus.ACCEPTED;
    }

    /** Decline (or remove yourself from) a collaboration. */
    @Transactional
    public void decline(String userId, String surveyId) {
        collaborators.deleteBySurveyAndUser(surveyId, userId);
    }

    private CollaboratorDto toDto(SurveyCollaborator c) {
        var user = users.findByIdOptional(c.userId).orElse(null);
        return new CollaboratorDto(
            c.userId,
            user != null ? user.email : null,
            user != null ? user.name : null,
            c.role,
            c.status);
    }
}
