package org.acme.repository;

import java.util.List;
import java.util.Optional;

import org.acme.entity.CollaboratorStatus;
import org.acme.entity.SurveyCollaborator;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class CollaboratorRepository
    implements PanacheRepositoryBase<SurveyCollaborator, String> {

    public List<SurveyCollaborator> findBySurvey(String surveyId) {
        return list("surveyId", surveyId);
    }

    public Optional<SurveyCollaborator> findBySurveyAndUser(String surveyId, String userId) {
        return find("surveyId = ?1 and userId = ?2", surveyId, userId).firstResultOptional();
    }

    /** The row an owner addresses by member id or invited email. */
    public Optional<SurveyCollaborator> findBySurveyAndMember(String surveyId, String userIdOrEmail) {
        return find("surveyId = ?1 and (userId = ?2 or email = ?3)",
            surveyId, userIdOrEmail, userIdOrEmail.trim().toLowerCase()).firstResultOptional();
    }

    private static final String OF_USER_OR_PENDING_EMAIL = "userId = ?1 or (status = ?2 and email = ?3)";

    /** Memberships plus the invitations still addressed to the user's email. */
    public List<SurveyCollaborator> findByUserOrPendingEmail(String userId, String email) {
        return list(OF_USER_OR_PENDING_EMAIL, userId, CollaboratorStatus.PENDING, email.trim().toLowerCase());
    }

    public long deleteByUserOrPendingEmail(String userId, String email) {
        return delete(OF_USER_OR_PENDING_EMAIL, userId, CollaboratorStatus.PENDING, email.trim().toLowerCase());
    }

    /** Accepted collaborations grant access; pending ones don't yet (#8). */
    public List<SurveyCollaborator> findAcceptedByUser(String userId) {
        return list("userId = ?1 and status = ?2", userId, CollaboratorStatus.ACCEPTED);
    }

    /** Outstanding invitations addressed to this (verified) email (#8). */
    public List<SurveyCollaborator> findPendingByEmail(String email) {
        return list("email = ?1 and status = ?2", email.trim().toLowerCase(), CollaboratorStatus.PENDING);
    }

    public Optional<SurveyCollaborator> findPendingBySurveyAndEmail(String surveyId, String email) {
        return find("surveyId = ?1 and email = ?2 and status = ?3",
            surveyId, email.trim().toLowerCase(), CollaboratorStatus.PENDING).firstResultOptional();
    }
}
