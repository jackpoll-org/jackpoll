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

    public List<SurveyCollaborator> findByUser(String userId) {
        return list("userId", userId);
    }

    /** Accepted collaborations grant access; pending ones don't yet (#8). */
    public List<SurveyCollaborator> findAcceptedByUser(String userId) {
        return list("userId = ?1 and status = ?2", userId, CollaboratorStatus.ACCEPTED);
    }

    /** Outstanding invitations awaiting this user's acceptance (#8). */
    public List<SurveyCollaborator> findPendingByUser(String userId) {
        return list("userId = ?1 and status = ?2", userId, CollaboratorStatus.PENDING);
    }

    public long deleteBySurveyAndUser(String surveyId, String userId) {
        return delete("surveyId = ?1 and userId = ?2", surveyId, userId);
    }
}
