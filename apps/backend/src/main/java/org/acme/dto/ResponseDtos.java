package org.acme.dto;

import java.util.List;
import java.util.Map;

import org.acme.entity.QuestionType;

import com.fasterxml.jackson.annotation.JsonInclude;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Response & results DTOs. Mirrors the frontend types in
 * {@code survey-frontend/app/types/survey.ts}.
 */
public final class ResponseDtos {

    private ResponseDtos() {}

    // ── Submit / raw responses ────────────────────────────────────

    /** One answer; {@code value} is arbitrary JSON (string, list, grid map, files). */
    public record AnswerDto(@Size(max = 128) String questionId, Object value) {}

    // Bounds on this anonymous, public write path: without them a single request
    // could carry an unbounded answer list / oversized fields up to the 10 MB body
    // cap. A survey can't realistically have more than a few hundred questions.
    public record SubmitResponseRequest(
        Long durationMs,
        @NotNull @Size(max = 1000) List<@Valid AnswerDto> answers,
        // Spam & bot protection (issue #31) — advisory client hints.
        /** Hidden honeypot field; must be empty for humans. */
        @Size(max = 1024) String honeypot,
        /** Signed begin-token issued when the form was opened (timing check). */
        @Size(max = 512) String beginToken,
        /** Stable per-browser id for the duplicate-submission guard. */
        @Size(max = 256) String clientId,
        /** Altcha proof-of-work payload (base64 JSON) when CAPTCHA is on. */
        @Size(max = 8192) String captcha,
        /** Optional respondent email for an opt-in receipt (issue #24). */
        @Size(max = 320) String respondentEmail,
        /** True for a builder preview/test submission — not counted in results. */
        Boolean preview,
        /** Respondent's name when the survey requires it (#). */
        @Size(max = 255) String respondentName,
        /** Language the form was answered in, so the emailed receipt matches it.
         *  Null falls back to the survey owner's language. */
        @Size(max = 16) String locale
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ResponseDto(
        String id,
        String submittedAt,
        Long durationMs,
        Integer score,
        Integer maxScore,
        Boolean passed,
        List<AnswerDto> answers,
        // Edit after submission (issue #40); null when editing isn't enabled.
        String editToken,
        String editedAt,
        // Respondent's name when the survey required it (#); null otherwise.
        String respondentName
    ) {}

    /** The data needed to re-open a response for editing (issue #40). */
    public record ResponseEditView(
        String surveyId,
        ResponseDto response
    ) {}

    // ── Aggregated results ────────────────────────────────────────

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SurveyResultsDto(
        String surveyId,
        String title,
        long totalResponses,
        String lastResponseAt,
        /** Mean respondent completion time in ms; null when no timed responses. */
        Long avgDurationMs,
        List<QuestionResultDto> questions,
        /** Present only for quiz surveys (issue #10). */
        QuizStatsDto quiz
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuizStatsDto(
        int maxScore,
        Integer passingScore,
        double averageScore,
        long passedCount,
        long failedCount,
        List<ScoreBucket> distribution
    ) {}

    public record ScoreBucket(int score, long count) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuestionResultDto(
        String questionId,
        QuestionType type,
        String title,
        long answered,
        /** Choice/dropdown/checkboxes: optionId → count. */
        Map<String, Long> optionCounts,
        /** Grid types: per-row column counts. */
        List<RowResultDto> rows,
        /** Short answer: collected free-text values. */
        List<String> textAnswers,
        /** File upload: uploaded file references. */
        List<FileRefDto> files,
        /** Slider (#55): mean of the numeric answers, null otherwise. */
        Double average,
        /** Slider (#55): median of the numeric answers, null otherwise. */
        Double median
    ) {}

    public record RowResultDto(String rowId, Map<String, Long> columnCounts) {}

    /** {@code key} is the stable storage object key; the client builds the
     *  display URL from it via the upload proxy (the {@code url} field is kept
     *  for backward compatibility). */
    public record FileRefDto(String key, String url, String filename) {}
}
