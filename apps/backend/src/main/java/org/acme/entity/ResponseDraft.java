package org.acme.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An in-progress, anonymous survey draft for save &amp; resume (issue #26).
 * Identified by an unguessable {@code token}; never counted as a submission and
 * never aggregated into results. Drafts expire at {@code expiresAt}.
 */
@Entity
@Table(name = "response_drafts")
public class ResponseDraft extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    /** Unguessable resume token, scoped to one survey. */
    @Column(nullable = false, unique = true, length = 48)
    public String token;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    /** Saved answers as JSON: a list of {questionId, value} objects. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Object answers;

    /** Index of the respondent's current position (best-effort). */
    @Column(name = "position")
    public Integer position;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;
}
