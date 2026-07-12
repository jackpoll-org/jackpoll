package org.acme.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * A selectable option for a choice-based question, or a row/column label for a
 * grid question — distinguished by {@link OptionKind}.
 */
@Entity
@Table(name = "question_options")
public class QuestionOption extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @ManyToOne
    @JoinColumn(name = "question_id", nullable = false)
    public Question question;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    public OptionKind kind = OptionKind.OPTION;

    @Column(nullable = false, length = 500)
    public String label;

    /** Position within its kind. Named to avoid the SQL reserved word "order". */
    @Column(name = "option_order", nullable = false)
    public int order;

    /** Optional response quota for single-select choices (issue #38); null = unlimited. */
    public Integer capacity;

    /** Reserved selections, maintained atomically at submit/edit/delete time (#38). */
    @Column(nullable = false)
    public int used;
}
