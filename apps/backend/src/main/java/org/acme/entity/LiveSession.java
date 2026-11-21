package org.acme.entity;

import java.time.Instant;

import org.acme.dto.SurveyDtos.SurveyDto;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One run of a survey. Live runs are opened when the presenter starts the
 * game; scheduled runs open and close on their own window and freeze the
 * survey's content in {@link #snapshot} when they open. Answers carry the id
 * of their run ({@link SurveyResponse#sessionId}), so each run's results stay separate.
 */
@Entity
@Table(name = "live_sessions")
public class LiveSession extends PanacheEntityBase {

    public static final String LIVE = "live";
    public static final String SCHEDULED = "scheduled";

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    @Column(name = "started_at", nullable = false)
    public Instant startedAt;

    @Column(nullable = false, length = 16)
    public String kind = LIVE;

    @Column(length = 120)
    public String label;

    @Column(name = "opens_at")
    public Instant opensAt;

    @Column(name = "closes_at")
    public Instant closesAt;

    @Column(name = "closed_at")
    public Instant closedAt;

    @Basic(fetch = FetchType.LAZY)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public SurveyDto snapshot;

    @Column(name = "snapshot_at")
    public Instant snapshotAt;

    public boolean isScheduled() {
        return SCHEDULED.equals(kind);
    }

    public String status(Instant now) {
        if (closedAt != null || closesAt == null || !now.isBefore(closesAt)) return "closed";
        return opensAt == null || now.isBefore(opensAt) ? "scheduled" : "open";
    }

    public boolean isOpen(Instant now) {
        return "open".equals(status(now));
    }
}
