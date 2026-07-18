package org.acme.service;

import java.util.List;
import java.util.UUID;

import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.dto.CollaboratorDtos.CollaboratorDto;
import org.acme.dto.CollaboratorDtos.InvitationDto;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.SurveyCollaborator;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.NotificationPreferenceRepository;
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

    @Inject
    EmailService emailService;

    @Inject
    NotificationRecordService notificationRecordService;

    @Inject
    NotificationPreferenceRepository notificationPrefs;

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

        // Notify the invitee (best-effort) so they can accept the invitation.
        var owner = users.findByIdOptional(ownerId).orElse(null);
        var ownerName = owner != null && owner.name != null ? owner.name : "Someone";
        String inviteBody = ownerName + " invited you to collaborate on \"" + survey.title + "\".";
        pushService.notifyUser(user.id, NotificationEventType.COLLABORATOR_INVITED,
            "Collaboration invite", inviteBody);
        notificationRecordService.record(user.id, NotificationEventType.COLLABORATOR_INVITED,
            "Collaboration invite", inviteBody, "/surveys/" + surveyId);
        if (notificationPrefs.isEnabled(user.id,
                NotificationEventType.COLLABORATOR_INVITED.key(), NotificationChannel.EMAIL.key())) {
            emailService.sendCollaboratorInvite(user.email, survey.title, ownerName);
        }

        return toDto(collaborator);
    }

    @Transactional
    public void remove(String ownerId, String surveyId, String userId) {
        var survey = surveyService.requireOwner(ownerId, surveyId);
        notifyRemoved(survey.id, survey.title, ownerId, userId);
        collaborators.deleteBySurveyAndUser(surveyId, userId);
    }

    /** Notify the removed collaborator (called before their row is deleted). */
    private void notifyRemoved(String surveyId, String surveyTitle, String ownerId, String removedUserId) {
        var owner = users.findByIdOptional(ownerId).orElse(null);
        var ownerName = owner != null && owner.name != null ? owner.name : "The owner";
        var type = NotificationEventType.COLLABORATOR_REMOVED;
        String title = "Removed from " + surveyTitle;
        String body = ownerName + " removed you as a collaborator on \"" + surveyTitle + "\".";
        pushService.notifyUser(removedUserId, type, title, body);
        notificationRecordService.record(removedUserId, type, title, body, "/surveys");
        if (notificationPrefs.isEnabled(removedUserId, type.key(), NotificationChannel.EMAIL.key())) {
            users.findByIdOptional(removedUserId).ifPresent(
                u -> emailService.sendCollaboratorRemoved(u.email, surveyTitle, ownerName));
        }
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
        notifyOwnerOfResponse(surveyId, userId, NotificationEventType.COLLABORATOR_ACCEPTED,
            "Invite accepted", " accepted your invitation to collaborate on \"",
            EmailService::sendCollaboratorAccepted);
    }

    /** Decline (or remove yourself from) a collaboration. */
    @Transactional
    public void decline(String userId, String surveyId) {
        notifyOwnerOfResponse(surveyId, userId, NotificationEventType.COLLABORATOR_DECLINED,
            "Invite declined", " declined your invitation to collaborate on \"",
            EmailService::sendCollaboratorDeclined);
        collaborators.deleteBySurveyAndUser(surveyId, userId);
    }

    private interface CollabEmailSender {
        void send(EmailService emailService, String toEmail, String surveyTitle, String personName);
    }

    /** Notify the survey owner that {@code actingUserId} responded to their invite. */
    private void notifyOwnerOfResponse(String surveyId, String actingUserId,
            NotificationEventType type, String pushTitle, String bodySuffix, CollabEmailSender sender) {
        var survey = surveys.findByIdOptional(surveyId).orElse(null);
        if (survey == null) return;
        var actingUser = users.findByIdOptional(actingUserId).orElse(null);
        var actingName = actingUser != null && actingUser.name != null ? actingUser.name : "Someone";
        String body = actingName + bodySuffix + survey.title + "\".";
        pushService.notifyUser(survey.ownerId, type, pushTitle, body);
        notificationRecordService.record(survey.ownerId, type, pushTitle, body, "/surveys/" + surveyId);
        if (notificationPrefs.isEnabled(survey.ownerId, type.key(), NotificationChannel.EMAIL.key())) {
            var owner = users.findByIdOptional(survey.ownerId).orElse(null);
            if (owner != null) sender.send(emailService, owner.email, survey.title, actingName);
        }
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
