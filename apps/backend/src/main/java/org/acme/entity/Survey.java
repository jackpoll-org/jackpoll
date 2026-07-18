package org.acme.entity;

import java.time.Instant;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "surveys")
public class Survey extends PanacheEntityBase {

    @Id
    @Column(length = 36)
    public String id;

    /** Keycloak user id (sub claim) of the owner. */
    @Column(name = "owner_id", nullable = false, length = 36)
    public String ownerId;

    @Column(nullable = false, length = 255)
    public String title;

    @Column(columnDefinition = "text")
    public String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public SurveyStatus status = SurveyStatus.DRAFT;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public SurveySettings settings;

    @OneToMany(mappedBy = "survey", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("order ASC")
    public List<Question> questions = new ArrayList<>();

    // Multi-page surveys (issue #28) — ordered sections grouping questions.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public List<Section> sections = new ArrayList<>();

    // Organization (issue #33) — owner-managed tags and an optional folder.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public List<String> tags = new ArrayList<>();

    @Column(name = "folder_id", length = 36)
    public String folderId;

    // Manual drag-to-reorder position within the owner's folder/root view
    // (issue #94); lower sorts first. Null = unordered (falls back to recency).
    @Column(name = "sort_position")
    public Double sortPosition;

    // Multilingual content (issue #37) — enabled locales, the default/canonical
    // locale, and a per-locale translation bag keyed by stable field ids
    // (e.g. "title", "question:<id>:title", "option:<id>:label"). Empty/null
    // languages means a single-language survey (unchanged behaviour).
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public List<String> languages = new ArrayList<>();

    @Column(name = "default_language", length = 10)
    public String defaultLanguage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    public Map<String, Map<String, String>> i18n;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    // Last response-count threshold already notified for (#89's response-
    // milestone event) — fires once per crossing, not on every response after.
    @Column(name = "milestone_notified", nullable = false)
    public int milestoneNotified = 0;

    @PrePersist
    void onCreate() {
        var now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = SurveyStatus.DRAFT;
        if (settings == null) settings = SurveySettings.defaults();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
