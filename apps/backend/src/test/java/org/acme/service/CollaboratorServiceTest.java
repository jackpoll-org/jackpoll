package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
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
        service.users = users;
        service.surveys = surveys;
        service.pushService = pushService;
        service.emailService = emailService;
        service.notificationRecordService = notificationRecordService;
        service.notificationPrefs = notificationPrefs;

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
    void accept_notifiesOwnerWithAcceptedEventType() {
        var invite = new SurveyCollaborator();
        invite.surveyId = SURVEY;
        invite.userId = INVITEE;
        invite.status = CollaboratorStatus.PENDING;
        when(collaborators.findBySurveyAndUser(SURVEY, INVITEE)).thenReturn(Optional.of(invite));
        when(surveys.findByIdOptional(SURVEY)).thenReturn(Optional.of(survey(SURVEY, OWNER, "My Survey")));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));

        service.accept(INVITEE, SURVEY);

        assertEquals(CollaboratorStatus.ACCEPTED, invite.status);
        verify(pushService).notifyUser(
            eq(OWNER), eq(NotificationEventType.COLLABORATOR_ACCEPTED), anyString(), anyString());
    }

    @Test
    void decline_notifiesOwnerBeforeDeletingRow() {
        when(surveys.findByIdOptional(SURVEY)).thenReturn(Optional.of(survey(SURVEY, OWNER, "My Survey")));
        when(users.findByIdOptional(INVITEE)).thenReturn(Optional.of(user(INVITEE, "invitee@example.com", "Invitee")));
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));

        service.decline(INVITEE, SURVEY);

        verify(pushService).notifyUser(
            eq(OWNER), eq(NotificationEventType.COLLABORATOR_DECLINED), anyString(), anyString());
        verify(collaborators).deleteBySurveyAndUser(SURVEY, INVITEE);
    }

    @Test
    void remove_notifiesRemovedUserWithRemovedEventType() {
        var survey = survey(SURVEY, OWNER, "My Survey");
        when(surveyService.requireOwner(OWNER, SURVEY)).thenReturn(survey);
        when(users.findByIdOptional(OWNER)).thenReturn(Optional.of(user(OWNER, "owner@example.com", "Owner")));

        service.remove(OWNER, SURVEY, INVITEE);

        verify(pushService).notifyUser(
            eq(INVITEE), eq(NotificationEventType.COLLABORATOR_REMOVED), anyString(), anyString());
        verify(collaborators).deleteBySurveyAndUser(SURVEY, INVITEE);
    }
}
