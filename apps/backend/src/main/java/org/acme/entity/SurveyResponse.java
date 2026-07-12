package org.acme.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** A single submitted survey response (anonymous). */
@Entity
@Table(name = "survey_responses")
public class SurveyResponse extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(name = "submitted_at", nullable = false)
    public Instant submittedAt;

    /** Time taken to complete, in milliseconds (optional). */
    @Column(name = "duration_ms")
    public Long durationMs;

    /** Hashed per-browser client id for the duplicate-submission guard (#31). */
    @Column(name = "client_id", length = 64)
    public String clientId;

    /** Unguessable token for editing this response after submission (#40). */
    @Column(name = "edit_token", length = 64)
    public String editToken;

    /** Set when the response has been edited after the original submission (#40). */
    @Column(name = "edited_at")
    public Instant editedAt;

    // Quiz mode (issue #10) — null for non-quiz surveys.
    @Column(name = "score")
    public Integer score;

    @Column(name = "max_score")
    public Integer maxScore;

    @Column(name = "passed")
    public Boolean passed;

    /** A test submission from the builder preview — excluded from results,
     *  consumes no quota, sends no notifications, auto-purged after 5 min (#). */
    @Column(nullable = false)
    public boolean preview = false;

    /** Respondent's name when the survey requires it (settings.requireRespondentName). */
    @Column(name = "respondent_name", length = 200)
    public String respondentName;

    @OneToMany(mappedBy = "response", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<ResponseAnswer> answers = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (submittedAt == null) submittedAt = Instant.now();
    }
}
