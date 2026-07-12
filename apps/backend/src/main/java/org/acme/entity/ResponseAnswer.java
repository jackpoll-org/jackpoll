package org.acme.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * One answer within a {@link SurveyResponse}. The value is stored as JSON so it
 * can hold any answer shape: a string, a list of option ids, a grid map, or a
 * list of uploaded-file objects.
 */
@Entity
@Table(name = "response_answers")
public class ResponseAnswer extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    @ManyToOne
    @JoinColumn(name = "response_id", nullable = false)
    public SurveyResponse response;

    @Column(name = "question_id", nullable = false, length = 36)
    public String questionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Object value;
}
