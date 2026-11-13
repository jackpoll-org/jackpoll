package org.acme.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.dto.CollaboratorDtos.CollaboratorDto;
import org.acme.dto.CollaboratorDtos.InvitationDto;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.SurveyCollaborator;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.RateLimitedException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.mail.MailCopy;
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

    private static final MailCopy COPY = MailCopy.of("messages");

    @Inject
    SurveyService surveyService;

    @Inject
    AuditService audit;

    @Inject
    CollaboratorRepository collaborators;

    @Inject
    UserRepository users;

    @Inject
    SurveyRepository surveys;

    private static final int INVITES_PER_HOUR = 30;

    @Inject
    PushService pushService;

    @Inject
    RateLimiterService rateLimiter;

    @Inject
    EmailService emailService;

    @Inject
    NotificationRecordService notificationRecordService;

    @Inject
    NotificationPreferenceRepository notificationPrefs;

    /** Only the owner sees e-mail addresses and pending invitations. */
    public List<CollaboratorDto> list(String requesterId, String surveyId) {
        var survey = surveyService.requireReadable(requesterId, surveyId);
        boolean owner = surveyService.isOwner(requesterId, survey);
        return collaborators.findBySurvey(surveyId).stream()
            .filter(c -> owner || c.status == CollaboratorStatus.ACCEPTED)
            .map(c -> toDto(c, owner))
            .toList();
    }

    @Transactional
    public CollaboratorDto add(String ownerId, String surveyId, AddCollaboratorRequest req) {
        var survey = surveyService.requireOwner(ownerId, surveyId);
        if (!rateLimiter.allow("collab-invite|" + ownerId, INVITES_PER_HOUR, 3600)) {
            throw new RateLimitedException("Too many invitations. Please try again later.");
        }

        // Same answer and same stored row with or without an account, so invites can't probe for accounts.
        var email = req.email().trim().toLowerCase();
        var invited = new CollaboratorDto(null, email, null, req.role(), CollaboratorStatus.PENDING);
        var user = users.findByEmail(email).orElse(null);
        if (user != null && user.id.equals(ownerId)) {
            throw new ForbiddenAccessException("You already own this survey.");
        }

        var existing = collaborators.findBySurveyAndMember(surveyId, email)
            .or(() -> user == null ? Optional.<SurveyCollaborator>empty() : collaborators.findBySurveyAndUser(surveyId, user.id))
            .orElse(null);
        if (existing != null) {
            // Re-inviting just updates the role; keep the existing accept state.
            existing.role = req.role();
            audit.record(ownerId, "collaborator.role", surveyId + "/" + email + "=" + req.role());
            return existing.status == CollaboratorStatus.ACCEPTED ? toDto(existing, true) : invited;
        }

        var collaborator = new SurveyCollaborator();
        collaborator.id = UUID.randomUUID().toString();
        collaborator.surveyId = surveyId;
        collaborator.email = email;
        collaborator.role = req.role();
        collaborator.status = CollaboratorStatus.PENDING;
        collaborators.persist(collaborator);
        audit.record(ownerId, "collaborator.add", surveyId + "/" + email + "=" + req.role());
        if (user == null) {
            return invited;
        }

        // Notify the invitee (best-effort) so they can accept the invitation.
        var owner = users.findByIdOptional(ownerId).orElse(null);
        var ownerName = owner != null && owner.name != null ? owner.name : COPY.t(user.locale, "notify.someone");
        String inviteTitle = COPY.t(user.locale, "notify.invite.title");
        String inviteBody = COPY.t(user.locale, "notify.invite.body", ownerName, survey.title);
        pushService.notifyUser(user.id, NotificationEventType.COLLABORATOR_INVITED, inviteTitle, inviteBody);
        notificationRecordService.record(user.id, NotificationEventType.COLLABORATOR_INVITED,
            inviteTitle, inviteBody, "/surveys/" + surveyId);
        if (notificationPrefs.isEnabled(user.id,
                NotificationEventType.COLLABORATOR_INVITED.key(), NotificationChannel.EMAIL.key())) {
            emailService.sendCollaboratorInvite(user.email, survey.title, ownerName);
        }

        return invited;
    }

    @Transactional
    public void remove(String ownerId, String surveyId, String member) {
        var survey = surveyService.requireOwner(ownerId, surveyId);
        var row = collaborators.findBySurveyAndMember(surveyId, member).orElse(null);
        if (row == null) return;
        if (row.userId != null) {
            notifyRemoved(survey.id, survey.title, ownerId, row.userId);
        }
        collaborators.delete(row);
        audit.record(ownerId, "collaborator.remove", surveyId + "/" + member);
    }

    /** Notify the removed collaborator (called before their row is deleted). */
    private void notifyRemoved(String surveyId, String surveyTitle, String ownerId, String removedUserId) {
        var owner = users.findByIdOptional(ownerId).orElse(null);
        var type = NotificationEventType.COLLABORATOR_REMOVED;
        String locale = users.localeOf(removedUserId);
        var ownerName = owner != null && owner.name != null ? owner.name : COPY.t(locale, "notify.theowner");
        String title = COPY.t(locale, "notify.removed.title", surveyTitle);
        String body = COPY.t(locale, "notify.removed.body", ownerName, surveyTitle);
        pushService.notifyUser(removedUserId, type, title, body);
        notificationRecordService.record(removedUserId, type, title, body, "/surveys");
        if (notificationPrefs.isEnabled(removedUserId, type.key(), NotificationChannel.EMAIL.key())) {
            users.findByIdOptional(removedUserId).ifPresent(
                u -> emailService.sendCollaboratorRemoved(u.email, surveyTitle, ownerName));
        }
    }

    // ── Invitee-facing (#8) ───────────────────────────────────────

    /** Pending invitations addressed to this user's verified email. */
    public List<InvitationDto> invitations(String userId) {
        return users.findByIdOptional(userId).filter(u -> u.emailVerified)
            .map(u -> collaborators.findPendingByEmail(u.email))
            .orElse(List.of()).stream()
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
        var invite = requireInvite(userId, surveyId);
        if (collaborators.findBySurveyAndUser(surveyId, userId).isPresent()) {
            collaborators.delete(invite);
            return;
        }
        invite.userId = userId;
        invite.status = CollaboratorStatus.ACCEPTED;
        notifyOwnerOfResponse(surveyId, userId, NotificationEventType.COLLABORATOR_ACCEPTED,
            "notify.accepted", EmailService::sendCollaboratorAccepted);
    }

    /** Decline (or remove yourself from) a collaboration. */
    @Transactional
    public void decline(String userId, String surveyId) {
        // Only someone actually invited may decline, or anyone could mail the owner at will.
        var invite = requireInvite(userId, surveyId);
        notifyOwnerOfResponse(surveyId, userId, NotificationEventType.COLLABORATOR_DECLINED,
            "notify.declined", EmailService::sendCollaboratorDeclined);
        collaborators.delete(invite);
    }

    private SurveyCollaborator requireInvite(String userId, String surveyId) {
        return users.findByIdOptional(userId).filter(u -> u.emailVerified)
            .flatMap(u -> collaborators.findPendingBySurveyAndEmail(surveyId, u.email))
            .orElseThrow(() -> new ResourceNotFoundException("No invitation for this survey."));
    }

    private interface CollabEmailSender {
        void send(EmailService emailService, String toEmail, String surveyTitle, String personName);
    }

    /** Notify the survey owner that {@code actingUserId} responded to their invite. */
    private void notifyOwnerOfResponse(String surveyId, String actingUserId,
            NotificationEventType type, String copyKey, CollabEmailSender sender) {
        var survey = surveys.findByIdOptional(surveyId).orElse(null);
        if (survey == null) return;
        var actingUser = users.findByIdOptional(actingUserId).orElse(null);
        String locale = users.localeOf(survey.ownerId);
        var actingName = actingUser != null && actingUser.name != null ? actingUser.name : COPY.t(locale, "notify.someone");
        String pushTitle = COPY.t(locale, copyKey + ".title");
        String body = COPY.t(locale, copyKey + ".body", actingName, survey.title);
        pushService.notifyUser(survey.ownerId, type, pushTitle, body);
        notificationRecordService.record(survey.ownerId, type, pushTitle, body, "/surveys/" + surveyId);
        if (notificationPrefs.isEnabled(survey.ownerId, type.key(), NotificationChannel.EMAIL.key())) {
            var owner = users.findByIdOptional(survey.ownerId).orElse(null);
            if (owner != null) sender.send(emailService, owner.email, survey.title, actingName);
        }
    }

    private CollaboratorDto toDto(SurveyCollaborator c, boolean withEmail) {
        if (c.status == CollaboratorStatus.PENDING) {
            return new CollaboratorDto(null, withEmail ? c.email : null, null, c.role, c.status);
        }
        var user = users.findByIdOptional(c.userId).orElse(null);
        return new CollaboratorDto(
            c.userId,
            withEmail && user != null ? user.email : null,
            user != null ? user.name : null,
            c.role,
            c.status);
    }
}
