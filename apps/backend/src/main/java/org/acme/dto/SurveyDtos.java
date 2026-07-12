package org.acme.dto;

import java.util.List;
import java.util.Map;

import org.acme.entity.QuestionType;
import org.acme.entity.SurveyStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Survey-related DTOs — mirrors the frontend types in
 * {@code survey-frontend/app/types/survey.ts}. Field names are kept identical
 * to avoid mapping drift between backend and frontend.
 */
public final class SurveyDtos {

    private SurveyDtos() {}

    // ── Options / grid rows & columns ─────────────────────────────

    public record OptionDto(
        String id,
        // Not @NotBlank: a draft being built may have empty options. Completeness
        // is enforced only on publish (SurveyService.update). #
        @Size(max = 500) String label,
        // Per-option quota (issue #38): capacity is owner-set (null = unlimited);
        // used is server-maintained and ignored on write.
        Integer capacity,
        Integer used
    ) {}

    // ── Question ──────────────────────────────────────────────────

    public record QuestionDto(
        String id,
        @NotNull QuestionType type,
        // Not @NotBlank: a draft may have untitled questions while being built;
        // a non-blank title is required only on publish (SurveyService.update).
        @Size(max = 500) String title,
        String description,
        boolean required,
        int order,
        List<@Valid OptionDto> options,   // choice types
        List<@Valid OptionDto> rows,      // grid types
        List<@Valid OptionDto> columns,   // grid types
        Map<String, Object> settings,
        Integer points,
        List<String> correctAnswers,
        Boolean showInLiveResults,
        // Multi-page surveys (issue #28) — owning section, null for flat surveys.
        String sectionId
    ) {}

    // ── Section (issue #28) ───────────────────────────────────────

    public record SectionDto(
        String id,
        @Size(max = 255) String title,
        String description,
        int order,
        /** Optional LogicRule controlling section visibility. */
        Map<String, Object> visibleIf
    ) {}

    // ── Survey settings ───────────────────────────────────────────

    public record OutcomeDto(
        String id,
        String title,
        String description,
        String imageUrl,
        Integer minScore,
        Integer maxScore
    ) {}

    public record SurveySettingsDto(
        boolean allowMultipleResponses,
        String confirmationMessage,
        String redirectUrl,
        boolean showProgressBar,
        boolean shuffleQuestions,
        boolean isQuiz,
        Integer timeLimit,
        Integer passingScore,
        String showCorrectAnswers,
        String opensAt,
        String closesAt,
        Integer responseLimit,
        boolean showLiveResults,
        boolean postSubmitSummary,
        String accentColor,
        String backgroundColor,
        String logoUrl,
        String headerImageUrl,
        boolean showPoweredBy,
        // Spam & bot protection (issue #31)
        Integer minSubmitSeconds,
        boolean rateLimit,
        boolean onePerBrowser,
        boolean requireCaptcha,
        // Email notifications (issue #24)
        String ownerNotify,
        boolean respondentReceipts,
        // Edit after submission (issue #40)
        boolean allowEditResponses,
        // Conversational layout (issue #82)
        boolean conversational,
        // Outcome pages (issue #83)
        java.util.List<OutcomeDto> outcomes,
        // Data retention (issue #64)
        Integer retentionDays,
        boolean retentionAnonymize,
        // Respondent privacy notice & legal basis (issue #63)
        String privacyNotice,
        boolean requireConsent,
        // Require + collect the respondent's name (#)
        boolean requireRespondentName,
        // Presenter-paced live mode (#)
        boolean liveMode,
        Integer liveQuestionSeconds,
        // First-page heading (issue #94 follow-up)
        String firstPageTitle,
        String firstPageDescription
    ) {}

    // ── Requests ──────────────────────────────────────────────────

    public record CreateSurveyRequest(
        @NotBlank @Size(max = 255) String title,
        String description
    ) {}

    public record UpdateSurveyRequest(
        @NotBlank @Size(max = 255) String title,
        String description,
        @NotNull SurveyStatus status,
        SurveySettingsDto settings,
        List<@Valid QuestionDto> questions,
        List<SectionDto> sections,
        // Multilingual content (issue #37) — optional, null/empty = single language.
        List<String> languages,
        String defaultLanguage,
        Map<String, Map<String, String>> i18n
    ) {}

    // ── Response ──────────────────────────────────────────────────

    public record SurveyDto(
        String id,
        String ownerId,
        String title,
        String description,
        SurveyStatus status,
        SurveySettingsDto settings,
        List<QuestionDto> questions,
        List<SectionDto> sections,
        List<String> tags,
        String folderId,
        // Manual drag-to-reorder position (issue #94); null = unordered.
        Double sortPosition,
        // Multilingual content (issue #37).
        List<String> languages,
        String defaultLanguage,
        Map<String, Map<String, String>> i18n,
        String createdAt,
        String updatedAt
    ) {}

    /** Lightweight organize update from the dashboard (issue #33). */
    public record OrganizeRequest(
        List<String> tags,
        String folderId
    ) {}

    /** Persist a manual drag order for one folder/root bucket (issue #94). */
    public record ReorderRequest(
        String folderId,
        List<String> orderedIds
    ) {}
}
