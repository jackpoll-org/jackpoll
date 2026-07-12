package org.acme.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A single aggregate analytics counter (issue #34): no cookies, no IPs, no
 * per-visitor records — only an incrementing count per (survey, dimension, key).
 */
@Entity
@Table(
    name = "analytics_counters",
    uniqueConstraints = @UniqueConstraint(columnNames = {"survey_id", "dimension", "metric_key"})
)
public class AnalyticsCounter extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @Column(name = "survey_id", nullable = false, length = 36)
    public String surveyId;

    /** stage | source | channel | device | day */
    @Column(nullable = false, length = 20)
    public String dimension;

    @Column(name = "metric_key", nullable = false, length = 120)
    public String key;

    @Column(nullable = false)
    public long count;
}
