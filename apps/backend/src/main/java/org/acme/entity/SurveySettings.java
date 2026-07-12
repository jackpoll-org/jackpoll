package org.acme.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Survey-level settings, persisted as a JSON column on {@link Survey}.
 * Mirrors the frontend {@code SurveySettings} interface. Quiz/confirmation
 * fields are present for forward-compatibility (issues #9, #10) but unused
 * in milestone 1.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SurveySettings {

    public boolean allowMultipleResponses;
    public String confirmationMessage;
    public String redirectUrl;
    public boolean showProgressBar;
    public boolean shuffleQuestions;

    /** Optional ISO-8601 instant before which the survey is not yet open (issue #39). */
    public String opensAt;

    /** Optional ISO-8601 instant after which the survey stops accepting responses. */
    public String closesAt;

    /** Optional max responses; 0 / null means unlimited (issue #19). */
    public Integer responseLimit;

    // Live results (issue #21) — master switch + post-submit summary, default off.
    public boolean showLiveResults;
    public boolean postSubmitSummary;

    // Branding (issue #30) — shown on public-facing pages.
    public String accentColor;
    public String backgroundColor;
    public String logoUrl;
    public String headerImageUrl;
    public boolean showPoweredBy;

    // Quiz mode (issue #10) — forward-compat, unused in milestone 1
    public boolean isQuiz;
    public Integer timeLimit;
    public Integer passingScore;
    public String showCorrectAnswers; // "immediately" | "after-submission" | "never"

    // Spam & bot protection (issue #31) — opt-in per survey, safe defaults off.
    /** Reject submissions faster than this many seconds (0 / null = off). */
    public Integer minSubmitSeconds;
    /** Enforce a per-IP rate limit on the submit endpoint. */
    public boolean rateLimit;
    /** Allow only one response per browser (client id). */
    public boolean onePerBrowser;
    /** Require a solved Altcha proof-of-work challenge. */
    public boolean requireCaptcha;

    // Email notifications (issue #24)
    /** Owner notification mode: "off" | "each" | "daily". */
    public String ownerNotify;
    /** Offer respondents an optional emailed receipt. */
    public boolean respondentReceipts;

    // Edit after submission (issue #40)
    /** Allow respondents to edit their response via a private link. */
    public boolean allowEditResponses;

    // Conversational layout (issue #82) — one question per screen.
    public boolean conversational;

    // First-page heading (issue #94 follow-up). Page 1 is the implicit ungrouped
    // bucket with no Section, so its optional title/description live here.
    public String firstPageTitle;
    public String firstPageDescription;

    // Score-based outcome pages (issue #83) — quiz result screens.
    public java.util.List<Outcome> outcomes;

    // Data retention (issue #64, GDPR Art. 5(1)(e)). Responses older than
    // retentionDays are purged by a daily job; null/0 = keep indefinitely.
    public Integer retentionDays;
    /** When true, expired responses are anonymised (de-linked) instead of deleted. */
    public boolean retentionAnonymize;

    // Respondent privacy notice & legal basis (issue #63, GDPR Art. 13).
    /** Owner-provided privacy/contact text shown to respondents before submit. */
    public String privacyNotice;
    /** Require respondents to tick a consent box before they can submit. */
    public boolean requireConsent;
    /** Require respondents to enter their name first; stored with the response. */
    public boolean requireRespondentName;
    /** Presenter-paced live mode: a host drives everyone through the questions
     *  one at a time; participants answer only the presented question (#). */
    public boolean liveMode;
    /** Live quiz per-question countdown in seconds; faster correct answers score
     *  more (#). 0 = no timer / no speed bonus. */
    public Integer liveQuestionSeconds;

    public static SurveySettings defaults() {
        var s = new SurveySettings();
        s.allowMultipleResponses = false;
        s.showProgressBar = false;
        s.shuffleQuestions = false;
        s.isQuiz = false;
        return s;
    }
}
