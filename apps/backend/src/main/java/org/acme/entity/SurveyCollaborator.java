package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Grants a user editor/viewer access to a survey they don't own. */
@Entity
@Table(
    name = "survey_collaborators",
    uniqueConstraints = @UniqueConstraint(columnNames = {"survey_id", "user_id"})
)
public class SurveyCollaborator extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(name = "user_id", nullable = false, length = 36)
    public String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public CollaboratorRole role;

    /** PENDING until the invitee accepts; ACCEPTED grants access (#8). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public CollaboratorStatus status = CollaboratorStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
