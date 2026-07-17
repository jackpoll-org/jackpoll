package org.acme.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "questions")
public class Question extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @ManyToOne
    @JoinColumn(name = "survey_id", nullable = false)
    public Survey survey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    public QuestionType type;

    @Column(nullable = false, length = 500)
    public String title;

    @Column(columnDefinition = "text")
    public String description;

    @Column(nullable = false)
    public boolean required;

    /** Position within the survey. Named to avoid the SQL reserved word "order". */
    @Column(name = "question_order", nullable = false)
    public int order;

    /** Optional owning section for multi-page surveys (issue #28). */
    @Column(name = "section_id", length = 36)
    public String sectionId;

    /** Type-specific config (forward-compat for validation/logic, issues #4/#6). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Map<String, Object> settings;

    /** Per-question live-results override (issue #21); null = type default. */
    @Column(name = "show_in_live_results")
    public Boolean showInLiveResults;

    // Quiz mode (issue #10) — forward-compat, unused in milestone 1
    public Integer points;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "correct_answers", columnDefinition = "jsonb")
    public List<String> correctAnswers;

    /** Case-sensitive grading for short-answer quiz questions; null/false = case-insensitive. */
    @Column(name = "case_sensitive_answers")
    public Boolean caseSensitiveAnswers;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("order ASC")
    public List<QuestionOption> options = new ArrayList<>();
}
