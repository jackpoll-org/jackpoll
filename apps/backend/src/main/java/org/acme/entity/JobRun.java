package org.acme.entity;

import java.time.LocalDate;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The last day a once-a-day job ran, so only one backend replica runs it. */
@Entity
@Table(name = "job_runs")
public class JobRun extends PanacheEntityBase {

    @Id
    @Column(length = 64)
    public String name;

    @Column(name = "run_on", nullable = false)
    public LocalDate runOn;
}
