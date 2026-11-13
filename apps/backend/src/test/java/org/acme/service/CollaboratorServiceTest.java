package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.entity.CollaboratorRole;
import org.acme.entity.CollaboratorStatus;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.Survey;
import org.acme.entity.SurveyCollaborator;
import org.acme.entity.User;
import org.acme.repository.CollaboratorRepository;
import org.acme.repository.NotificationPreferenceRepository;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Pure unit tests for {@link CollaboratorService} using mocked collaborators —
 * no Quarkus boot or database required. The {@code add_...} tests are the
 * direct regression guard for issue #89's collaborator-invite gating bug:
 * pushes must be tagged {@code COLLABORATOR_INVITED}, never {@code
 * NEW_RESPONSE}, so they can never again share the wrong preference.
 */
class CollaboratorServiceTest {

    private static final String OWNER = "owner-1";
    private static final String INVITEE = "invitee-1";
    private static final String SURVEY = "survey-1";

    private SurveyService surveyService;
    private CollaboratorRepository collaborators;
    private UserRepository users;
    private SurveyRepository surveys;
    private PushService pushService;
    private EmailService emailService;
    private NotificationRecordService notificationRecordService;
    private NotificationPreferenceRepository notificationPrefs;
    private CollaboratorService service;

    @BeforeEach
    void setUp() {
        surveyService = mock(SurveyService.class);
        collaborators = mock(CollaboratorRepository.class);
        users = mock(UserRepository.class);
        surveys = mock(SurveyRepository.class);
        pushService = mock(PushService.class);
        emailService = mock(EmailService.class);
        notificationRecordService = mock(NotificationRecordService.class);
        notificationPrefs = mock(NotificationPreferenceRepository.class);

        service = new CollaboratorService();
        service.surveyService = surveyService;
        service.collaborators = collaborators;
        service.audit = mock(AuditService.class);
        service.users = users;
        service.surveys = surveys;
        service.pushService = pushService;
        service.emailService = emailService;
        service.notificationRecordService = notificationRecordService;
        service.notificationPrefs = notificationPrefs;
        service.rateLimiter = mock(RateLimiterService.class);
        when(service.rateLimiter.allow(anyString(), anyInt(), anyLong())).thenReturn(true);

        // Default: every channel enabled (the all-on default), unless overridden per-test.
        when(notificationPrefs.isEnabled(anyString(), anyString(), anyString())).thenReturn(true);
    }

    private Survey survey(String id, String ownerId, String title) {
        var s = new Survey();
        s.id = id;
        s.ownerId = ownerId;
        s.title = title;
        return s;
    }

    private User user(String id, String email, String name) {
        var u = new User();
        u.id = id;
        u.email = email;
        u.name = name;
        u.emailVerified = true;
        u.createdAt = Instant.now();
        u.updatedAt = Instant.now();
        return u;
    }

    @Test
    void add_pushesWithCollaboratorInvitedEventType_notNewResponse() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        when(users.findByEmail("invitee@example.com"))
            .thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.empty());

        service.add(OWNER, SURVEY, new AddCollaboratorRequest("invitee@example.com", CollaboratorRole.EDITOR));

        verify(pushService).notifyUser(
            eq(INVITEE), eq(NotificationEventType.COLLABORATOR_INVITED), anyString(), anyString());
        verify(pushService, never()).notifyUser(
            eq(INVITEE), eq(NotificationEventType.NEW_RESPONSE), anyString(), anyString());
    }

    @Test
    void add_answersTheSameForKnownAndUnknownAddresses() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        when(users.findByEmail("invitee@example.com"))
            .thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByEmail("stranger@example.com")).thenReturn(Optional.empty());
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.empty());

        var known = service.add(OWNER, SURVEY, new AddCollaboratorRequest("invitee@example.com", CollaboratorRole.EDITOR));
        var unknown = service.add(OWNER, SURVEY, new AddCollaboratorRequest("stranger@example.com", CollaboratorRole.EDITOR));

        assertEquals(known.userId(), unknown.userId());
        assertEquals(known.name(), unknown.name());
        assertEquals(known.status(), unknown.status());
        var rows = org.mockito.ArgumentCaptor.forClass(SurveyCollaborator.class);
        verify(collaborators, org.mockito.Mockito.times(2)).persist(rows.capture());
        assertEquals("invitee@example.com", rows.getAllValues().get(0).email);
        assertEquals("stranger@example.com", rows.getAllValues().get(1).email);
        assertEquals(null, rows.getAllValues().get(0).userId);
        assertEquals(null, rows.getAllValues().get(1).userId);
    }

    @Test
    void add_sendsEmail_whenInviteEmailPrefEnabled() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        var invitee = user(INVITEE, "invitee@example.com", "Invitee");
        when(users.findByEmail("invitee@example.com")).thenReturn(Optional.of(invitee));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.empty());

        service.add(OWNER, SURVEY, new AddCollaboratorRequest("invitee@example.com", CollaboratorRole.EDITOR));

        verify(emailService).sendCollaboratorInvite(eq("invitee@example.com"), eq("My Survey"), anyString());
    }

    @Test
    void add_skipsEmail_whenInviteEmailPrefDisabled() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        when(users.findByEmail("invitee@example.com"))
            .thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.empty());
        when(notificationPrefs.isEnabled(INVITEE,
            NotificationEventType.COLLABORATOR_INVITED.key(), NotificationChannel.EMAIL.key()))
            .thenReturn(false);

        service.add(OWNER, SURVEY, new AddCollaboratorRequest("invitee@example.com", CollaboratorRole.EDITOR));

        verify(emailService, never()).sendCollaboratorInvite(anyString(), anyString(), anyString());
    }

    @Test
    void accept_bindsTheInviteAndNotifiesOwnerWithAcceptedEventType() {
        var invite = new SurveyCollaborator();
        invite.surveyId = SURVEY;
        invite.email = "invitee@example.com";
        invite.status = CollaboratorStatus.PENDING;
        when(collaborators.findPendingBySurveyAndEmail(SURVEY, "invitee@example.com")).thenReturn(Optional.of(invite));
        when(surveys.findByIdOptional(SURVEY)).thenReturn(Optional.of(survey(SURVEY, OWNER, "My Survey")));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));

        service.accept(INVITEE, SURVEY);

        assertEquals(CollaboratorStatus.ACCEPTED, invite.status);
        assertEquals(INVITEE, invite.userId);
        verify(pushService).notifyUser(
            eq(OWNER), eq(NotificationEventType.COLLABORATOR_ACCEPTED), anyString(), anyString());
    }

    @Test
    void add_reinvitingAnAcceptedMemberReturnsTheMember() {
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey(SURVEY, OWNER, "My Survey"));
        var invitee = user(INVITEE, "invitee@example.com", "Invitee");
        when(users.findByEmail("invitee@example.com")).thenReturn(Optional.of(invitee));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(invitee));
        var member = new SurveyCollaborator();
        member.surveyId = SURVEY;
        member.userId = INVITEE;
        member.status = CollaboratorStatus.ACCEPTED;
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.of(member));

        var dto = service.add(OWNER, SURVEY, new AddCollaboratorRequest("invitee@example.com", CollaboratorRole.VIEWER));

        assertEquals(INVITEE, dto.userId());
        assertEquals("Invitee", dto.name());
        assertEquals(CollaboratorStatus.ACCEPTED, dto.status());
        assertEquals(CollaboratorRole.VIEWER, member.role);
    }

    @Test
    void accept_byAnExistingMemberDropsTheInviteAndKeepsTheMembership() {
        var invite = new SurveyCollaborator();
        invite.surveyId = SURVEY;
        invite.email = "invitee@example.com";
        invite.status = CollaboratorStatus.PENDING;
        var member = new SurveyCollaborator();
        member.userId = INVITEE;
        member.status = CollaboratorStatus.ACCEPTED;
        when(collaborators.findPendingBySurveyAndEmail(SURVEY, "invitee@example.com")).thenReturn(Optional.of(invite));
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.of(member));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));

        service.accept(INVITEE, SURVEY);

        verify(collaborators).delete(invite);
        assertEquals(null, invite.userId);
        verify(pushService, never()).notifyUser(anyString(), any(), anyString(), anyString());
    }

    @Test
    void decline_notifiesOwnerBeforeDeletingRow() {
        when(surveys.findByIdOptional(SURVEY)).thenReturn(Optional.of(survey(SURVEY, OWNER, "My Survey")));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        var invite = new SurveyCollaborator();
        invite.status = CollaboratorStatus.PENDING;
        when(collaborators.findPendingBySurveyAndEmail(SURVEY, "invitee@example.com")).thenReturn(Optional.of(invite));

        service.decline(INVITEE, SURVEY);

        verify(pushService).notifyUser(
            eq(OWNER), eq(NotificationEventType.COLLABORATOR_DECLINED), anyString(), anyString());
        verify(collaborators).delete(invite);
    }

    @Test
    void decline_withoutAnInvitationNotifiesNobody() {
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));

        org.junit.jupiter.api.Assertions.assertThrows(
            org.acme.exception.ResourceNotFoundException.class, () -> service.decline(INVITEE, SURVEY));

        verify(pushService, org.mockito.Mockito.never()).notifyUser(
            anyString(), org.mockito.ArgumentMatchers.any(), anyString(), anyString());
    }

    @Test
    void remove_notifiesRemovedUserWithRemovedEventType() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));
        var member = new SurveyCollaborator();
        member.userId = INVITEE;
        member.status = CollaboratorStatus.ACCEPTED;
        when(collaborators.findBySurveyAndMember(SURVEY, INVITEE)).thenReturn(Optional.of(member));

        service.remove(OWNER, SURVEY, INVITEE);

        verify(pushService).notifyUser(
            eq(INVITEE), eq(NotificationEventType.COLLABORATOR_REMOVED), anyString(), anyString());
        verify(collaborators).delete(member);
    }

    @Test
    void remove_ofAPendingInviteDeletesItSilently() {
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey(SURVEY, OWNER, "My Survey"));
        var pending = new SurveyCollaborator();
        pending.email = "invitee@example.com";
        pending.status = CollaboratorStatus.PENDING;
        when(collaborators.findBySurveyAndMember(SURVEY, "invitee@example.com")).thenReturn(Optional.of(pending));

        service.remove(OWNER, SURVEY, "invitee@example.com");

        verify(collaborators).delete(pending);
        verify(pushService, never()).notifyUser(anyString(), any(), anyString(), anyString());
    }

    @Test
    void remove_ofANonCollaboratorNotifiesNobody() {
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey(SURVEY, OWNER, "My Survey"));
        when(collaborators.findBySurveyAndMember(SURVEY, INVITEE)).thenReturn(Optional.empty());

        service.remove(OWNER, SURVEY, INVITEE);

        verify(pushService, never()).notifyUser(anyString(), any(), anyString(), anyString());
    }

    @Test
    void list_hidesEmailsAndPendingInvitesFromNonOwners() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireReadable(INVITEE, SURVEY)).thenReturn(survey);
        when(surveyService.isOwner(INVITEE, survey)).thenReturn(false);
        var accepted = new SurveyCollaborator();
        accepted.userId = INVITEE;
        accepted.status = CollaboratorStatus.ACCEPTED;
        var pending = new SurveyCollaborator();
        pending.email = "pending@example.com";
        pending.status = CollaboratorStatus.PENDING;
        when(collaborators.findBySurvey(SURVEY)).thenReturn(java.util.List.of(accepted, pending));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));

        var list = service.list(INVITEE, SURVEY);

        assertEquals(1, list.size());
        assertEquals(null, list.get(0).email());
        assertEquals("Invitee", list.get(0).name());
    }

    @Test
    void invitations_onlyForAVerifiedEmail() {
        var unverified = user(INVITEE, "invitee@example.com", "Invitee");
        unverified.emailVerified = false;
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(unverified));

        assertEquals(0, service.invitations(INVITEE).size());
        verify(collaborators, never()).findPendingByEmail(anyString());
    }

    @Test
    void add_reinviteReturnsTheNeutralShape() {
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey(SURVEY, OWNER, "My Survey"));
        when(users.findByEmail("invitee@example.com"))
            .thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        var member = new SurveyCollaborator();
        member.userId = INVITEE;
        member.status = CollaboratorStatus.PENDING;
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.of(member));

        var dto = service.add(OWNER, SURVEY, new AddCollaboratorRequest("Invitee@Example.com", CollaboratorRole.VIEWER));

        assertEquals(null, dto.userId());
        assertEquals(null, dto.name());
        assertEquals(CollaboratorStatus.PENDING, dto.status());
        assertEquals(CollaboratorRole.VIEWER, member.role);
        verify(collaborators, never()).persist(any(SurveyCollaborator.class));
        verify(pushService, never()).notifyUser(anyString(), any(), anyString(), anyString());
    }

    @Test
    void list_showsKnownAndUnknownPendingInvitesIdentically() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireReadable(OWNER, SURVEY)).thenReturn(survey);
        when(surveyService.isOwner(OWNER, survey)).thenReturn(true);
        var known = new SurveyCollaborator();
        known.email = "invitee@example.com";
        known.role = CollaboratorRole.EDITOR;
        known.status = CollaboratorStatus.PENDING;
        var unknown = new SurveyCollaborator();
        unknown.email = "stranger@example.com";
        unknown.role = CollaboratorRole.EDITOR;
        unknown.status = CollaboratorStatus.PENDING;
        when(collaborators.findBySurvey(SURVEY)).thenReturn(java.util.List.of(known, unknown));
        when(users.findByEmail("invitee@example.com"))
            .thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));

        var list = service.list(OWNER, SURVEY);

        assertEquals(list.get(0).userId(), list.get(1).userId());
        assertEquals(list.get(0).name(), list.get(1).name());
        assertEquals("invitee@example.com", list.get(0).email());
        assertEquals("stranger@example.com", list.get(1).email());
    }
}
