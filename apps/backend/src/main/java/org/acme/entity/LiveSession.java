package org.acme.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One run of a live quiz, opened when the presenter starts the game. Live
 * answers carry the id of the session running when they arrive
 * ({@link SurveyResponse#sessionId}), so each game's results stay separate.
 */
@Entity
@Table(name = "live_sessions")
public class LiveSession extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(name = "started_at", nullable = false)
    public Instant startedAt;
}
