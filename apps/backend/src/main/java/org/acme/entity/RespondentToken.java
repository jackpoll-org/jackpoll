package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "respondent_tokens",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_respondent_tokens_survey_token", columnNames = {"survey_id", "token"}))
public class RespondentToken extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(nullable = false, length = 128)
    public String token;

    @Column(name = "used_at")
    public Instant usedAt;

    @Column(name = "session_id", length = 36)
    public String sessionId;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
