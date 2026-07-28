package org.acme.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.acme.dto.ResponseDtos.AnswerDto;
import org.acme.dto.ResponseDtos.FileRefDto;
import org.acme.dto.ResponseDtos.QuestionResultDto;
import org.acme.dto.ResponseDtos.ResponseDto;
import org.acme.dto.ResponseDtos.ResponseEditView;
import org.acme.dto.ResponseDtos.RowResultDto;
import org.acme.dto.ResponseDtos.SubmitResponseRequest;
import org.acme.dto.ResponseDtos.SurveyResultsDto;
import org.acme.entity.NotificationChannel;
import org.acme.entity.NotificationEventType;
import org.acme.entity.OptionKind;
import org.acme.entity.Question;
import org.acme.entity.QuestionOption;
import org.acme.entity.QuestionType;
import org.acme.entity.ResponseAnswer;
import org.acme.entity.Survey;
import org.acme.entity.SurveyResponse;
import org.acme.entity.SurveyStatus;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.QuotaExceededException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.NotificationPreferenceRepository;
import org.acme.repository.OptionRepository;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Persists survey responses and aggregates them into dashboard results. */
@ApplicationScoped
public class ResponseService {

    @Inject
    SurveyRepository surveyRepository;

    @Inject
    SurveyService surveyService;

    @Inject
    ShareLinkService shareLinkService;

    @Inject
    ResponseRepository responseRepository;

    @Inject
    OptionRepository optionRepository;

    @Inject
    SpamProtectionService spamProtection;

    @Inject
    EmailService emailService;

    @Inject
    WebhookService webhookService;

    @Inject
    PushService pushService;

    @Inject
    org.acme.resource.ResultsRelay resultsRelay;

    @Inject
    ProfanityFilter profanityFilter;

    @Inject
    com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Inject
    org.acme.repository.UserRepository userRepository;

    @Inject
    NotificationPreferenceRepository notificationPrefs;

    @Inject
    NotificationRecordService notificationRecordService;

    @Inject
    PdfService pdfService;

    /** Response-count thresholds that trigger a milestone notification (#89). */
    private static final int[] MILESTONE_THRESHOLDS =
        { 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000 };

    @org.eclipse.microprofile.config.inject.ConfigProperty(
        name = "survey.mail.async", defaultValue = "true")
    boolean mailAsync;

    /** Daemon pool so background email sends never keep the JVM alive. */
    private static final java.util.concurrent.ExecutorService MAIL_EXECUTOR =
        java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "email-dispatch");
            thread.setDaemon(true);
            return thread;
        });

    // ── Submit (public) ───────────────────────────────────────────

    @Transactional
    public ResponseDto submit(String surveyId, SubmitResponseRequest req) {
        return submit(surveyId, req, null);
    }

    @Transactional
    public ResponseDto submit(String surveyId, SubmitResponseRequest req, String clientIp) {
        // Survey must exist; submission is anonymous so no owner check.
        var survey = surveyRepository.findByIdOptional(surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));

        // Close time (#16) and response limit (#19).
        long countBeforeSubmit = responseRepository.countBySurvey(surveyId);
        SurveyAvailability.ensureOpen(survey, countBeforeSubmit);

        // Share-link expiry / response cap (issue #16).
        shareLinkService.ensureSurveyAcceptingResponses(surveyId);

        // Spam & bot protection (issue #31). A tripped honeypot is faked as
        // success so bots get no signal; other checks throw a generic error.
        boolean honeypotTripped = spamProtection.check(
            surveyId, survey.settings, clientIp,
            req.honeypot(), req.beginToken(), req.clientId(), req.captcha());
        if (honeypotTripped) {
            return new ResponseDto(
                UUID.randomUUID().toString(), Instant.now().toString(),
                req.durationMs(), null, null, null, java.util.List.of(), null, null, null);
        }

        // One-response-per-browser guard (issue #31).
        String hashedClientId = null;
        if (survey.settings != null && survey.settings.onePerBrowser) {
            hashedClientId = spamProtection.hashClientId(req.clientId());
            if (hashedClientId != null
                && responseRepository.existsByClientId(surveyId, hashedClientId)) {
                throw new org.acme.exception.SpamRejectedException(
                    "You have already responded to this survey.");
            }
        }

        // Server-side answer validation (#55), e.g. slider range.
        validateAnswers(survey, req);

        var response = new SurveyResponse();
        response.id = UUID.randomUUID().toString();
        response.surveyId = surveyId;
        response.submittedAt = Instant.now();
        response.durationMs = req.durationMs();
        response.clientId = hashedClientId;
        // A builder preview/test submission: stored but excluded from results,
        // consumes no quota and triggers no notifications (#).
        response.preview = Boolean.TRUE.equals(req.preview());

        // Respondent name (#): required when the survey enables it (real
        // submissions only — a preview test needn't fill it).
        var name = req.respondentName() != null ? req.respondentName().trim() : null;
        if (!response.preview && survey.settings != null
            && survey.settings.requireRespondentName
            && (name == null || name.isBlank())) {
            throw new org.acme.exception.SurveyIncompleteException(
                "Please enter your name before submitting.");
        }
        response.respondentName = name != null && !name.isBlank() ? name : null;

        var values = new java.util.HashMap<String, Object>();
        if (req.answers() != null) {
            for (var a : req.answers()) {
                var answer = new ResponseAnswer();
                answer.id = UUID.randomUUID().toString();
                answer.response = response;
                answer.questionId = a.questionId();
                answer.value = a.value();
                response.answers.add(answer);
                values.put(a.questionId(), a.value());
            }
        }

        // Quiz scoring happens server-side (issue #10).
        if (survey.settings != null && survey.settings.isQuiz) {
            response.score = QuizScoring.score(survey, values);
            response.maxScore = QuizScoring.maxScore(survey);
            // Live quiz: a correct answer scores more the faster it comes in (#).
            var seconds = survey.settings.liveQuestionSeconds;
            if (survey.settings.liveMode && seconds != null && seconds > 0
                && response.score != null && response.score > 0 && req.durationMs() != null) {
                response.score = QuizScoring.speedAdjusted(
                    response.score, req.durationMs(), seconds * 1000L);
            }
            var passingScore = survey.settings.passingScore;
            response.passed = passingScore != null ? response.score >= passingScore : null;
        }

        // Per-option quotas (issue #38) — atomic, race-safe; rejects if full.
        // Preview submissions must not consume quota.
        if (!response.preview) {
            reserveQuotasOrThrow(survey, response.answers);
        }

        // Edit-after-submission token (issue #40), only when the survey allows it.
        if (survey.settings != null && survey.settings.allowEditResponses) {
            response.editToken = randomEditToken();
        }

        responseRepository.persist(response);
        var dto = toDto(response);

        // Preview/test submissions are owner-internal: no emails, webhooks, push,
        // or live-results broadcast — and they're filtered out of results below.
        if (response.preview) {
            return dto;
        }

        // Email notifications & receipts (issue #24) — best-effort, never blocks
        // or fails the submission. Owner email is resolved here (in-transaction)
        // and only the actual send runs off-thread.
        dispatchEmails(survey, response, req.respondentEmail(), req.locale());

        // Outbound webhooks (issue #36) — HMAC-signed, off-thread, best-effort.
        webhookService.dispatchResponse(surveyId, dto);

        // Native push to the owner's devices (mobile app) — opt-in, best-effort.
        pushService.notifyUser(
            survey.ownerId, NotificationEventType.NEW_RESPONSE,
            survey.title, "You received a new response.");

        // In-app notification (#89) — opt-in, best-effort.
        notificationRecordService.record(
            survey.ownerId, NotificationEventType.NEW_RESPONSE,
            survey.title, "You received a new response.",
            "/surveys/" + survey.id + "/results");

        // Response-milestone notification (#89) — fires once per threshold crossing.
        maybeNotifyMilestone(survey, countBeforeSubmit + 1);

        // Live-results push (wordcloud / presentation mode) — best-effort, never
        // blocks or fails the submission. When live results are enabled we push
        // the just-submitted words as a delta so viewers update their cloud
        // without a refetch; otherwise a bare "updated" ping triggers an
        // (authenticated) refetch so nothing leaks on the open socket.
        resultsRelay.broadcast(surveyId, buildResultsBroadcast(survey, req));

        return dto;
    }

    /** Normalize a wordcloud word so deltas key the same as aggregation. */
    private static String normalizeWord(String s) {
        return s.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    /**
     * Build the live-results socket message for a submission. When the survey
     * exposes live results, returns a JSON delta of the just-submitted wordcloud
     * words (profanity-filtered) so viewers merge it into their cloud without a
     * refetch. Otherwise returns the bare {@code "updated"} ping. Best-effort:
     * any failure falls back to the ping.
     */
    private String buildResultsBroadcast(Survey survey, SubmitResponseRequest req) {
        try {
            if (survey.settings == null || !survey.settings.showLiveResults
                || req.answers() == null) {
                return "updated";
            }
            var byId = new HashMap<String, Question>();
            for (var q : survey.questions) byId.put(q.id, q);

            var deltas = new ArrayList<Map<String, Object>>();
            for (var a : req.answers()) {
                var q = byId.get(a.questionId());
                if (q == null || q.type != QuestionType.WORDCLOUD) continue;
                if (!liveAllowed(survey, q)) continue;
                boolean filter = q.settings == null
                    || !Boolean.FALSE.equals(q.settings.get("filterProfanity"));
                var words = new ArrayList<String>();
                if (a.value() instanceof List<?> list) {
                    for (var w : list) {
                        if (w instanceof String s) {
                            var norm = normalizeWord(s);
                            if (norm.isBlank()) continue;
                            if (filter && profanityFilter.isProfane(norm)) continue;
                            words.add(norm);
                        }
                    }
                }
                if (!words.isEmpty()) {
                    deltas.add(Map.of("questionId", q.id, "words", words));
                }
            }
            if (deltas.isEmpty()) return "updated";
            return objectMapper.writeValueAsString(Map.of("v", 1, "deltas", deltas));
        } catch (Exception e) {
            return "updated";
        }
    }

    /** Fire owner notification + respondent receipt without blocking submit. */
    private void dispatchEmails(Survey survey, SurveyResponse response,
                                String respondentEmail, String respondentLocale) {
        if (survey.settings == null) return;
        var settings = survey.settings;

        // Owner email also requires the account-level "new response → email"
        // preference to be on (issue #89), on top of the per-survey cadence.
        var owner = userRepository.findByIdOptional(survey.ownerId).orElse(null);
        String ownerEmail = "each".equals(settings.ownerNotify)
            && notificationPrefs.isEnabled(survey.ownerId,
                NotificationEventType.NEW_RESPONSE.key(), NotificationChannel.EMAIL.key())
            ? (owner == null ? null : owner.email)
            : null;
        boolean wantReceipt = settings.respondentReceipts
            && respondentEmail != null && !respondentEmail.isBlank();
        if (ownerEmail == null && !wantReceipt) return;

        String title = survey.title;
        String surveyId = survey.id;
        boolean isQuiz = settings.isQuiz;
        Integer score = response.score;
        Integer maxScore = response.maxScore;
        // The respondent has no account, so their language comes from the form
        // they just filled in; failing that, from the owner whose survey it is —
        // a German survey's receipt should not arrive in English.
        String receiptLocale = respondentLocale != null && !respondentLocale.isBlank()
            ? respondentLocale
            : (owner == null ? null : owner.locale);

        Runnable task = () -> {
            if (ownerEmail != null) {
                emailService.sendOwnerNotification(ownerEmail, surveyId, title);
            }
            if (wantReceipt) {
                emailService.sendReceipt(
                    respondentEmail, title, isQuiz, score, maxScore, receiptLocale);
            }
        };

        if (mailAsync) {
            MAIL_EXECUTOR.execute(() -> {
                try {
                    task.run();
                } catch (Exception ignored) {
                    // best-effort; submission already succeeded
                }
            });
        } else {
            task.run();
        }
    }

    /**
     * Fire a response-milestone notification (#89) the first time {@code
     * newCount} reaches or passes a threshold beyond what's already been
     * notified for this survey — never on every response after.
     */
    private void maybeNotifyMilestone(Survey survey, long newCount) {
        int highestCrossed = survey.milestoneNotified;
        for (int threshold : MILESTONE_THRESHOLDS) {
            if (newCount >= threshold && threshold > highestCrossed) {
                highestCrossed = threshold;
            }
        }
        if (highestCrossed == survey.milestoneNotified) return;
        survey.milestoneNotified = highestCrossed;
        final int milestone = highestCrossed;

        String title = "Milestone reached";
        String body = survey.title + " just hit " + milestone + " responses!";
        pushService.notifyUser(survey.ownerId, NotificationEventType.RESPONSE_MILESTONE, title, body);
        notificationRecordService.record(survey.ownerId, NotificationEventType.RESPONSE_MILESTONE,
            title, body, "/surveys/" + survey.id + "/results");
        if (notificationPrefs.isEnabled(survey.ownerId,
                NotificationEventType.RESPONSE_MILESTONE.key(), NotificationChannel.EMAIL.key())) {
            userRepository.findByIdOptional(survey.ownerId).ifPresent(owner -> {
                if (mailAsync) {
                    MAIL_EXECUTOR.execute(() -> {
                        try {
                            emailService.sendMilestoneNotification(owner.email, survey.title, milestone);
                        } catch (Exception ignored) {
                            // best-effort
                        }
                    });
                } else {
                    emailService.sendMilestoneNotification(owner.email, survey.title, milestone);
                }
            });
        }
    }

    // ── Edit after submission (issue #40) — public, token-scoped ──

    /** Re-open a response for editing via its private token. */
    public ResponseEditView getForEdit(String editToken) {
        var response = findEditableOrThrow(editToken);
        return new ResponseEditView(response.surveyId, toDto(response));
    }

    /** Replace a response's answers in place (no new row → no double-counting). */
    @Transactional
    public ResponseDto updateForEdit(String editToken, SubmitResponseRequest req) {
        var response = findEditableOrThrow(editToken);
        var survey = surveyRepository.findByIdOptional(response.surveyId)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found"));

        // Server-side answer validation (#55), e.g. slider range.
        validateAnswers(survey, req);

        // Release the quota the previous answers held before re-counting (#38).
        var capped = cappedOptionIds(survey);
        for (var optId : selectedCapped(capped, response.answers)) {
            optionRepository.release(optId);
        }

        response.answers.clear();
        var values = new java.util.HashMap<String, Object>();
        if (req.answers() != null) {
            for (var a : req.answers()) {
                var answer = new ResponseAnswer();
                answer.id = UUID.randomUUID().toString();
                answer.response = response;
                answer.questionId = a.questionId();
                answer.value = a.value();
                response.answers.add(answer);
                values.put(a.questionId(), a.value());
            }
        }

        if (survey.settings != null && survey.settings.isQuiz) {
            response.score = QuizScoring.score(survey, values);
            response.maxScore = QuizScoring.maxScore(survey);
            var passingScore = survey.settings.passingScore;
            response.passed = passingScore != null ? response.score >= passingScore : null;
        }

        // Re-reserve for the new selection; a now-full option rolls the tx back.
        reserveQuotasOrThrow(survey, response.answers);

        response.editedAt = Instant.now();
        return toDto(response);
    }

    private SurveyResponse findEditableOrThrow(String editToken) {
        if (editToken == null || editToken.isBlank()) {
            throw new ResourceNotFoundException("Response not found.");
        }
        var response = responseRepository.findByEditToken(editToken)
            .orElseThrow(() -> new ResourceNotFoundException("Response not found."));
        var survey = surveyRepository.findByIdOptional(response.surveyId).orElse(null);
        if (survey == null || survey.settings == null || !survey.settings.allowEditResponses) {
            // The owner disabled editing (or the survey is gone).
            throw new ResourceNotFoundException("Editing is no longer available.");
        }
        return response;
    }

    // ── Owner reads ───────────────────────────────────────────────

    public List<ResponseDto> list(
        String ownerId, String surveyId, String from, String to, boolean includePreview) {
        requireOwnedSurvey(ownerId, surveyId);
        var fromInstant = parseInstant(from);
        var toInstant = parseInstant(to);
        return responseRepository.findBySurvey(surveyId, includePreview).stream()
            .filter(r -> fromInstant == null || !r.submittedAt.isBefore(fromInstant))
            .filter(r -> toInstant == null || !r.submittedAt.isAfter(toInstant))
            .map(this::toDto)
            .toList();
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    // ── Owner deletes (issue #25) ─────────────────────────────────

    @Transactional
    public void deleteResponse(String ownerId, String surveyId, String responseId) {
        surveyService.requireOwner(ownerId, surveyId);
        var response = responseRepository.findByIdOptional(responseId)
            .filter(r -> r.surveyId.equals(surveyId))
            .orElseThrow(() -> new ResourceNotFoundException("Response not found: " + responseId));
        // Free any quota the deleted response held (#38).
        var survey = surveyRepository.findByIdOptional(surveyId).orElse(null);
        if (survey != null) {
            var capped = cappedOptionIds(survey);
            for (var optId : selectedCapped(capped, response.answers)) {
                optionRepository.release(optId);
            }
        }
        responseRepository.delete(response);
    }

    @Transactional
    public long clearResponses(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        // Clear everything, including any preview/test rows.
        var responses = responseRepository.findBySurvey(surveyId, true);
        responses.forEach(responseRepository::delete);
        // All responses gone → reset every option counter for the survey (#38).
        optionRepository.resetUsedForSurvey(surveyId);
        return responses.size();
    }

    /** Delete the survey's preview/test submissions now (owner "delete preview"). */
    @Transactional
    public long deletePreviewResponses(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        return responseRepository.deletePreviewBySurvey(surveyId);
    }

    /** Auto-purge preview submissions older than 5 minutes (#). */
    @org.eclipse.microprofile.config.inject.ConfigProperty(
        name = "survey.preview.ttl-minutes", defaultValue = "5")
    long previewTtlMinutes;

    @io.quarkus.scheduler.Scheduled(every = "60s")
    @Transactional
    void purgeOldPreviewResponses() {
        var cutoff = Instant.now().minus(previewTtlMinutes, ChronoUnit.MINUTES);
        responseRepository.deletePreviewOlderThan(cutoff);
    }

    // ── Data retention (issue #64) ────────────────────────────────

    /**
     * Purge or anonymise responses to {@code survey} older than its retention
     * window. Delete mode releases any quota the response held (#38);
     * anonymise mode de-links the response from the respondent (clears the
     * hashed client id and edit token) while keeping answers for aggregates.
     * Runs in its own transaction per survey. Returns the number affected.
     */
    @Transactional
    public int applyRetention(Survey survey, int retentionDays, boolean anonymize) {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        var expired = responseRepository.findOlderThan(survey.id, cutoff);
        if (expired.isEmpty()) return 0;
        if (anonymize) {
            for (var r : expired) {
                r.clientId = null;
                r.editToken = null;
            }
        } else {
            var capped = cappedOptionIds(survey);
            for (var r : expired) {
                for (var optId : selectedCapped(capped, r.answers)) {
                    optionRepository.release(optId);
                }
                responseRepository.delete(r);
            }
        }
        return expired.size();
    }

    public SurveyResultsDto results(String ownerId, String surveyId, boolean includePreview) {
        var survey = requireOwnedSurvey(ownerId, surveyId);
        var responses = responseRepository.findBySurvey(surveyId, includePreview);

        var lastResponseAt = responses.stream()
            .map(r -> r.submittedAt)
            .max(Instant::compareTo)
            .map(Instant::toString)
            .orElse(null);

        var avgDurationMs = responses.stream()
            .map(r -> r.durationMs)
            .filter(java.util.Objects::nonNull)
            .mapToLong(Long::longValue)
            .average()
            .stream()
            .mapToObj(avg -> Long.valueOf(Math.round(avg)))
            .findFirst()
            .orElse(null);

        var questionResults = survey.questions.stream()
            .map(q -> aggregateQuestion(q, responses))
            .toList();

        var quiz = (survey.settings != null && survey.settings.isQuiz)
            ? quizStats(survey, responses)
            : null;

        return new SurveyResultsDto(
            survey.id, survey.title, responses.size(), lastResponseAt, avgDurationMs,
            questionResults, quiz);
    }

    private org.acme.dto.ResponseDtos.QuizStatsDto quizStats(
        Survey survey, List<SurveyResponse> responses) {
        var scored = responses.stream().filter(r -> r.score != null).toList();
        var maxScore = QuizScoring.maxScore(survey);
        var average = scored.stream().mapToInt(r -> r.score).average().orElse(0.0);
        var passed = scored.stream().filter(r -> Boolean.TRUE.equals(r.passed)).count();
        var failed = scored.stream().filter(r -> Boolean.FALSE.equals(r.passed)).count();

        var counts = new java.util.TreeMap<Integer, Long>();
        for (var r : scored) {
            counts.merge(r.score, 1L, Long::sum);
        }
        var distribution = counts.entrySet().stream()
            .map(e -> new org.acme.dto.ResponseDtos.ScoreBucket(e.getKey(), e.getValue()))
            .toList();

        return new org.acme.dto.ResponseDtos.QuizStatsDto(
            maxScore, survey.settings.passingScore, average, passed, failed, distribution);
    }

    // ── Live results (public, issue #21) ──────────────────────────

    public SurveyResultsDto liveResults(String surveyId) {
        var survey = surveyRepository.findByIdOptional(surveyId)
            .filter(s -> s.status == SurveyStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Survey not found: " + surveyId));
        if (survey.settings == null || !survey.settings.showLiveResults) {
            throw new ForbiddenAccessException("Live results are not enabled.");
        }
        var responses = responseRepository.findBySurvey(surveyId);
        var questions = survey.questions.stream()
            .filter(q -> liveAllowed(survey, q))
            .map(q -> aggregateQuestion(q, responses))
            .toList();
        return new SurveyResultsDto(
            survey.id, survey.title, responses.size(), null, null, questions, null);
    }

    /** Server-side guard: free-text and file-upload answers are never exposed. */
    private static boolean liveAllowed(Survey survey, Question q) {
        if (survey.settings == null || !survey.settings.showLiveResults) return false;
        switch (q.type) {
            case SHORT_ANSWER, FILE_UPLOAD -> {
                return false;
            }
            default -> {
                // multiple-choice / dropdown / checkboxes / grids
            }
        }
        return q.showInLiveResults == null ? true : q.showInLiveResults;
    }

    // ── Aggregation ───────────────────────────────────────────────

    private QuestionResultDto aggregateQuestion(Question q, List<SurveyResponse> responses) {
        var values = collectValues(q.id, responses);

        Map<String, Long> optionCounts = null;
        List<RowResultDto> rows = null;
        List<String> textAnswers = null;
        List<FileRefDto> files = null;
        Double average = null;
        Double median = null;

        switch (q.type) {
            case MULTIPLE_CHOICE, DROPDOWN -> {
                optionCounts = zeroedOptionCounts(q);
                for (var v : values) {
                    if (v instanceof String s) optionCounts.merge(s, 1L, Long::sum);
                }
            }
            case CHECKBOXES -> {
                optionCounts = zeroedOptionCounts(q);
                for (var v : values) {
                    if (v instanceof List<?> list) {
                        for (var item : list) {
                            if (item instanceof String s) optionCounts.merge(s, 1L, Long::sum);
                        }
                    }
                }
            }
            case RANKING -> {
                // Borda count: an option ranked first (index 0) of N scores N
                // points, last scores 1 — higher total = more preferred (#78).
                optionCounts = zeroedOptionCounts(q);
                int n = optionsOfKind(q, OptionKind.OPTION).size();
                for (var v : values) {
                    if (v instanceof List<?> order) {
                        for (int i = 0; i < order.size(); i++) {
                            if (order.get(i) instanceof String id) {
                                optionCounts.merge(id, (long) (n - i), Long::sum);
                            }
                        }
                    }
                }
            }
            case RATING_GRID -> {
                // One numeric rating per row → a value histogram per row (#81).
                rows = new ArrayList<>();
                for (var row : optionsOfKind(q, OptionKind.ROW)) {
                    var counts = new LinkedHashMap<String, Long>();
                    for (var v : values) {
                        if (v instanceof Map<?, ?> map && map.get(row.id) instanceof Number num) {
                            counts.merge(numberLabel(num.doubleValue()), 1L, Long::sum);
                        }
                    }
                    rows.add(new RowResultDto(row.id, counts));
                }
            }
            case MULTIPLE_CHOICE_GRID, CHECKBOX_GRID -> {
                rows = new ArrayList<>();
                for (var row : optionsOfKind(q, OptionKind.ROW)) {
                    var columnCounts = new LinkedHashMap<String, Long>();
                    for (var col : optionsOfKind(q, OptionKind.COLUMN)) {
                        columnCounts.put(col.id, 0L);
                    }
                    for (var v : values) {
                        if (v instanceof Map<?, ?> map) {
                            var cell = map.get(row.id);
                            if (cell instanceof String s) {
                                columnCounts.merge(s, 1L, Long::sum);
                            } else if (cell instanceof List<?> cells) {
                                for (var c : cells) {
                                    if (c instanceof String s) columnCounts.merge(s, 1L, Long::sum);
                                }
                            }
                        }
                    }
                    rows.add(new RowResultDto(row.id, columnCounts));
                }
            }
            case SHORT_ANSWER, DATE -> {
                textAnswers = new ArrayList<>();
                for (var v : values) {
                    if (v instanceof String s && !s.isBlank()) textAnswers.add(s);
                }
            }
            case WORDCLOUD -> {
                // Each respondent submits a list of words → a word → count
                // frequency map (normalized: trimmed, lowercased, whitespace
                // collapsed) so the cloud sizes by popularity. Profane words are
                // dropped from the cloud unless the question disables filtering.
                boolean filterProfanity = q.settings == null
                    || !Boolean.FALSE.equals(q.settings.get("filterProfanity"));
                optionCounts = new LinkedHashMap<>();
                for (var v : values) {
                    if (v instanceof List<?> words) {
                        for (var w : words) {
                            if (w instanceof String s) {
                                var norm = s.trim().toLowerCase().replaceAll("\\s+", " ");
                                if (norm.isBlank()) continue;
                                if (filterProfanity && profanityFilter.isProfane(norm)) continue;
                                optionCounts.merge(norm, 1L, Long::sum);
                            }
                        }
                    }
                }
            }
            case FILE_UPLOAD, SIGNATURE -> {
                files = new ArrayList<>();
                for (var v : values) {
                    if (v instanceof List<?> list) {
                        for (var item : list) {
                            if (item instanceof Map<?, ?> m) {
                                files.add(new FileRefDto(asString(m.get("key")), asString(m.get("url")), asString(m.get("filename"))));
                            }
                        }
                    }
                }
            }
            case SLIDER, RATING -> {
                // Numeric answers → a histogram (value → count), sorted ascending,
                // plus mean and median (#55/#77).
                var numbers = new ArrayList<Double>();
                var histogram = new java.util.TreeMap<Double, Long>();
                for (var v : values) {
                    if (v instanceof Number n) {
                        numbers.add(n.doubleValue());
                        histogram.merge(n.doubleValue(), 1L, Long::sum);
                    }
                }
                optionCounts = new LinkedHashMap<>();
                for (var e : histogram.entrySet()) {
                    optionCounts.put(numberLabel(e.getKey()), e.getValue());
                }
                if (!numbers.isEmpty()) {
                    average = numbers.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                    java.util.Collections.sort(numbers);
                    int mid = numbers.size() / 2;
                    median = numbers.size() % 2 == 1
                        ? numbers.get(mid)
                        : (numbers.get(mid - 1) + numbers.get(mid)) / 2.0;
                }
            }
        }

        return new QuestionResultDto(
            q.id, q.type, q.title, values.size(), optionCounts, rows, textAnswers, files,
            average, median);
    }

    private List<Object> collectValues(String questionId, List<SurveyResponse> responses) {
        var values = new ArrayList<Object>();
        for (var r : responses) {
            for (var a : r.answers) {
                if (a.questionId.equals(questionId) && !isEmpty(a.value)) {
                    values.add(a.value);
                }
            }
        }
        return values;
    }

    private Map<String, Long> zeroedOptionCounts(Question q) {
        var counts = new LinkedHashMap<String, Long>();
        for (var o : optionsOfKind(q, OptionKind.OPTION)) {
            counts.put(o.id, 0L);
        }
        return counts;
    }

    private List<QuestionOption> optionsOfKind(Question q, OptionKind kind) {
        return q.options.stream().filter(o -> o.kind == kind).toList();
    }

    private static boolean isEmpty(Object value) {
        if (value == null) return true;
        if (value instanceof String s) return s.isBlank();
        if (value instanceof List<?> l) return l.isEmpty();
        if (value instanceof Map<?, ?> m) return m.isEmpty();
        return false;
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    /** Render a slider value, dropping a trailing ".0" for whole numbers. */
    private static String numberLabel(double value) {
        return value == Math.rint(value)
            ? Long.toString((long) value)
            : Double.toString(value);
    }

    // ── Helpers ───────────────────────────────────────────────────

    private Survey requireOwnedSurvey(String userId, String surveyId) {
        // Owner, editors and viewers may read responses/results.
        return surveyService.requireReadable(userId, surveyId);
    }

    private ResponseDto toDto(SurveyResponse r) {
        var answers = r.answers.stream()
            .map(a -> new AnswerDto(a.questionId, a.value))
            .toList();
        return new ResponseDto(
            r.id,
            r.submittedAt != null ? r.submittedAt.toString() : null,
            r.durationMs,
            r.score,
            r.maxScore,
            r.passed,
            answers,
            r.editToken,
            r.editedAt != null ? r.editedAt.toString() : null,
            r.respondentName);
    }

    // ── Server-side answer validation (issue #55) ─────────────────

    /** Reject slider/rating answers that aren't a number within the configured range. */
    private void validateAnswers(Survey survey, SubmitResponseRequest req) {
        if (req.answers() == null) return;
        var byId = new java.util.HashMap<String, Question>();
        for (var q : survey.questions) byId.put(q.id, q);
        for (var a : req.answers()) {
            var q = byId.get(a.questionId());
            if (q == null || a.value() == null) continue;
            if (q.type == QuestionType.SLIDER) {
                if (!(a.value() instanceof Number num)) {
                    throw badRequest("Invalid value for a slider question.");
                }
                double v = num.doubleValue();
                if (v < settingDouble(q, "min", 0) || v > settingDouble(q, "max", 100)) {
                    throw badRequest("A slider answer is out of range.");
                }
            } else if (q.type == QuestionType.RATING) {
                if (!(a.value() instanceof Number num)) {
                    throw badRequest("Invalid value for a rating question.");
                }
                double v = num.doubleValue();
                double[] range = ratingRange(q);
                if (v < range[0] || v > range[1]) {
                    throw badRequest("A rating answer is out of range.");
                }
            }
        }
    }

    /** Allowed [min,max] for a rating answer, derived from its variant (#77). */
    private double[] ratingRange(Question q) {
        var variant = q.settings != null && q.settings.get("variant") != null
            ? q.settings.get("variant").toString()
            : "stars";
        return switch (variant) {
            case "nps" -> new double[] { 0, 10 };
            case "emoji", "likert" -> new double[] { 1, 5 };
            default -> new double[] { 1, settingDouble(q, "max", 5) }; // stars
        };
    }

    private static double settingDouble(Question q, String key, double def) {
        if (q.settings != null && q.settings.get(key) instanceof Number n) return n.doubleValue();
        return def;
    }

    private static jakarta.ws.rs.BadRequestException badRequest(String message) {
        return new jakarta.ws.rs.BadRequestException(
            jakarta.ws.rs.core.Response.status(400)
                .entity(org.acme.dto.ApiResponse.error(message)).build());
    }

    // ── Per-option quotas (issue #38) ─────────────────────────────

    /** Ids of single-select options that carry a capacity, for this survey. */
    private Set<String> cappedOptionIds(Survey survey) {
        var ids = new HashSet<String>();
        for (var q : survey.questions) {
            if (q.type != QuestionType.MULTIPLE_CHOICE && q.type != QuestionType.DROPDOWN) {
                continue;
            }
            for (var o : q.options) {
                if (o.kind == OptionKind.OPTION && o.capacity != null) ids.add(o.id);
            }
        }
        return ids;
    }

    /** The capped option ids actually selected across the given answers. */
    private List<String> selectedCapped(Set<String> capped, List<ResponseAnswer> answers) {
        if (capped.isEmpty()) return List.of();
        var selected = new ArrayList<String>();
        for (var a : answers) {
            if (a.value instanceof String s && capped.contains(s)) selected.add(s);
        }
        return selected;
    }

    /** Reserve a slot for each capped selection; throws if any option is full. */
    private void reserveQuotasOrThrow(Survey survey, List<ResponseAnswer> answers) {
        var capped = cappedOptionIds(survey);
        for (var optId : selectedCapped(capped, answers)) {
            if (!optionRepository.tryReserve(optId)) {
                throw new QuotaExceededException(
                    "One of your selections is no longer available. Please choose another.");
            }
        }
    }

    private static final java.security.SecureRandom EDIT_RANDOM = new java.security.SecureRandom();

    private static String randomEditToken() {
        byte[] bytes = new byte[32];
        EDIT_RANDOM.nextBytes(bytes);
        return java.util.HexFormat.of().formatHex(bytes);
    }

    // ── PDF export (issue #84) ────────────────────────────────────

    /** Render a single response as a branded PDF — owner/editor/viewer only. */
    public byte[] responsePdf(String ownerId, String surveyId, String responseId) {
        var survey = requireOwnedSurvey(ownerId, surveyId);
        var response = responseRepository.findByIdOptional(responseId)
            .orElseThrow(() -> new ResourceNotFoundException("Response not found: " + responseId));
        if (!surveyId.equals(response.surveyId)) {
            throw new ResourceNotFoundException("Response not found: " + responseId);
        }
        return pdfService.render(buildResponseHtml(survey, response));
    }

    private String buildResponseHtml(Survey survey, SurveyResponse response) {
        var accent = survey.settings != null && survey.settings.accentColor != null
            && !survey.settings.accentColor.isBlank()
            ? survey.settings.accentColor : "#6d5ce7";
        var byId = new HashMap<String, Object>();
        for (var a : response.answers) byId.put(a.questionId, a.value);

        var sb = new StringBuilder();
        sb.append("<html><head><meta charset=\"utf-8\"/><style>")
          .append("body{font-family:sans-serif;color:#222;font-size:12px;margin:32px;}")
          .append("h1{color:").append(esc(accent)).append(";font-size:20px;margin:0 0 4px;}")
          .append(".meta{color:#666;font-size:11px;margin:0 0 16px;}")
          .append(".score{font-weight:bold;font-size:14px;margin:0 0 16px;}")
          .append(".q{margin:0 0 12px;padding:0 0 12px;border-bottom:1px solid #eee;}")
          .append(".qt{font-weight:bold;margin:0 0 3px;}")
          .append(".qa{white-space:pre-wrap;}")
          .append("</style></head><body>");
        sb.append("<h1>").append(esc(survey.title)).append("</h1>");
        sb.append("<p class=\"meta\">Submitted ")
          .append(response.submittedAt != null ? esc(response.submittedAt.toString()) : "")
          .append("</p>");
        if (survey.settings != null && survey.settings.isQuiz && response.score != null) {
            sb.append("<p class=\"score\">Score: ").append(response.score).append(" / ")
              .append(response.maxScore != null ? response.maxScore : 0);
            if (response.passed != null) {
                sb.append(" — ").append(response.passed ? "Passed" : "Failed");
            }
            sb.append("</p>");
        }
        var questions = survey.questions.stream()
            .sorted((a, b) -> Integer.compare(a.order, b.order)).toList();
        for (var q : questions) {
            sb.append("<div class=\"q\"><div class=\"qt\">").append(esc(q.title))
              .append("</div><div class=\"qa\">")
              .append(esc(renderAnswer(q, byId.get(q.id))))
              .append("</div></div>");
        }
        sb.append("</body></html>");
        return sb.toString();
    }

    /** Human-readable rendering of an answer value, resolving option labels. */
    private String renderAnswer(Question q, Object value) {
        if (value == null) return "—";
        var labels = new HashMap<String, String>();
        for (var o : q.options) labels.put(o.id, o.label);
        switch (q.type) {
            case MULTIPLE_CHOICE, DROPDOWN -> {
                return value instanceof String s ? labels.getOrDefault(s, s) : value.toString();
            }
            case CHECKBOXES, RANKING -> {
                if (value instanceof List<?> list) {
                    var parts = new ArrayList<String>();
                    for (var item : list) {
                        var id = item == null ? "" : item.toString();
                        parts.add(labels.getOrDefault(id, id));
                    }
                    return String.join(", ", parts);
                }
                return value.toString();
            }
            case MULTIPLE_CHOICE_GRID, CHECKBOX_GRID, RATING_GRID -> {
                if (value instanceof Map<?, ?> map) {
                    var parts = new ArrayList<String>();
                    for (var e : map.entrySet()) {
                        var row = labels.getOrDefault(String.valueOf(e.getKey()), String.valueOf(e.getKey()));
                        var cell = e.getValue();
                        String cellStr;
                        if (cell instanceof List<?> cells) {
                            var cs = new ArrayList<String>();
                            for (var c : cells) cs.add(labels.getOrDefault(String.valueOf(c), String.valueOf(c)));
                            cellStr = String.join(", ", cs);
                        } else {
                            cellStr = labels.getOrDefault(String.valueOf(cell), String.valueOf(cell));
                        }
                        parts.add(row + ": " + cellStr);
                    }
                    return String.join("\n", parts);
                }
                return value.toString();
            }
            case FILE_UPLOAD, SIGNATURE -> {
                if (value instanceof List<?> list) {
                    var parts = new ArrayList<String>();
                    for (var item : list) {
                        if (item instanceof Map<?, ?> m) parts.add(String.valueOf(m.get("filename")));
                    }
                    return String.join(", ", parts);
                }
                return value.toString();
            }
            default -> {
                return value.toString();
            }
        }
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace("\"", "&quot;");
    }
}
