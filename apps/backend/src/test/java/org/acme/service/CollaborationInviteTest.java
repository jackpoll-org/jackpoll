package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.acme.dto.CollaboratorDtos.AddCollaboratorRequest;
import org.acme.entity.CollaboratorRole;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.acme.entity.User;
import org.acme.repository.SurveyRepository;
import org.acme.repository.UserRepository;
import org.junit.jupiter.api.Test;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

/** Collaboration invitations: pending until accepted, then access is granted (#8). */
@QuarkusTest
class CollaborationInviteTest {

    @Inject
    CollaboratorService collaborators;

    @Inject
    SurveyService surveyService;

    @Inject
    UserRepository users;

    @Inject
    SurveyRepository surveys;

    private void seedUser(String id, String email) {
        QuarkusTransaction.requiringNew().run(() -> {
            var u = new User();
            u.id = id;
            u.email = email;
            u.name = "User " + id;
            u.emailVerified = true;
            users.persist(u);
        });
    }

    private String seedSurvey(String ownerId) {
        String sid = UUID.randomUUID().toString();
        QuarkusTransaction.requiringNew().run(() -> {
            var s = new Survey();
            s.id = sid;
            s.ownerId = ownerId;
            s.title = "Team survey";
            s.status = SurveyStatus.DRAFT;
            s.createdAt = Instant.now();
            s.updatedAt = Instant.now();
            surveys.persist(s);
        });
        return sid;
    }

    @Test
    void inviteIsPendingUntilAcceptedThenGrantsAccess() {
        String owner = UUID.randomUUID().toString();
        String invitee = UUID.randomUUID().toString();
        String inviteeEmail = invitee + "@test.local";
        seedUser(owner, owner + "@test.local");
        seedUser(invitee, inviteeEmail);
        String surveyId = seedSurvey(owner);

        collaborators.add(
            owner, surveyId, new AddCollaboratorRequest(inviteeEmail, CollaboratorRole.EDITOR));

        // Pending: invitation is listed, but the survey is not yet accessible.
        assertEquals(1, collaborators.invitations(invitee).size());
        assertFalse(
            surveyService.list(invitee, 0, 50).stream().anyMatch(s -> s.id().equals(surveyId)),
            "pending invite must not grant access yet");

        collaborators.accept(invitee, surveyId);

        // Accepted: invitation cleared, survey now accessible to the invitee.
        assertEquals(0, collaborators.invitations(invitee).size());
        assertTrue(
            surveyService.list(invitee, 0, 50).stream().anyMatch(s -> s.id().equals(surveyId)),
            "accepted collaboration must grant access");
    }

    @Test
    void declineRemovesTheInvitation() {
        String owner = UUID.randomUUID().toString();
        String invitee = UUID.randomUUID().toString();
        String inviteeEmail = invitee + "@test.local";
        seedUser(owner, owner + "@test.local");
        seedUser(invitee, inviteeEmail);
        String surveyId = seedSurvey(owner);

        collaborators.add(
            owner, surveyId, new AddCollaboratorRequest(inviteeEmail, CollaboratorRole.VIEWER));
        assertEquals(1, collaborators.invitations(invitee).size());

        collaborators.decline(invitee, surveyId);
        assertEquals(0, collaborators.invitations(invitee).size());
        assertFalse(
            surveyService.list(invitee, 0, 50).stream().anyMatch(s -> s.id().equals(surveyId)));
    }
}
