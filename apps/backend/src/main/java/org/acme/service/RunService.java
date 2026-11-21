package org.acme.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

import org.acme.dto.RunDtos.PublicRunDto;
import org.acme.dto.RunDtos.RunDto;
import org.acme.dto.RunDtos.RunRequest;
import org.acme.dto.SurveyDtos.QuestionDto;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.entity.LiveSession;
import org.acme.entity.Survey;
import org.acme.exception.ForbiddenAccessException;
import org.acme.exception.ResourceNotFoundException;
import org.acme.exception.RunException;
import org.acme.mapper.SurveyMapper;
import org.acme.repository.LiveSessionRepository;
import org.acme.repository.ResponseRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class RunService {

    static final int MAX_LABEL_LENGTH = 120;
    static final int MAX_RUNS = 100;

    @Inject
    SurveyService surveyService;

    @Inject
    LiveSessionRepository runs;

    @Inject
    ResponseRepository responses;

    @Inject
    SurveyMapper mapper;

    public List<RunDto> list(String userId, String surveyId) {
        surveyService.requireEditable(userId, surveyId);
        var counts = new HashMap<String, Long>();
        for (Object[] row : responses.sessionStats(surveyId)) counts.put((String) row[0], (Long) row[1]);
        var now = Instant.now();
        return runs.findScheduled(surveyId).stream()
            .map(run -> toDto(run, counts.getOrDefault(run.id, 0L), now))
            .toList();
    }

    @Transactional
    public RunDto create(String userId, String surveyId, RunRequest req) {
        return create(surveyService.requireEditable(userId, surveyId), req);
    }

    private RunDto create(Survey survey, RunRequest req) {
        runs.getEntityManager().lock(survey, LockModeType.PESSIMISTIC_WRITE);
        long existing = runs.countScheduled(survey.id);
        if (existing >= MAX_RUNS) {
            throw RunException.conflict("RUN_LIMIT", "A survey can have at most " + MAX_RUNS + " runs.");
        }
        var run = new LiveSession();
        run.id = UUID.randomUUID().toString();
        run.surveyId = survey.id;
        run.kind = LiveSession.SCHEDULED;
        apply(survey, run, req);
        runs.persist(run);
        freezeEarlierResponses(survey);
        return toDto(run, 0, Instant.now());
    }

    public void freezeEarlierResponses(Survey survey) {
        if (isLive(survey)) return;
        runs.getEntityManager().lock(survey, LockModeType.PESSIMISTIC_WRITE);
        var first = responses.firstSubmissionWithoutSession(survey.id);
        if (first == null) return;
        var id = UUID.nameUUIDFromBytes(("frozen-run:" + survey.id).getBytes(StandardCharsets.UTF_8)).toString();
        if (runs.findByIdOptional(id).isEmpty()) {
            var now = Instant.now().truncatedTo(ChronoUnit.MICROS);
            var run = new LiveSession();
            run.id = id;
            run.surveyId = survey.id;
            run.kind = LiveSession.SCHEDULED;
            run.opensAt = first.truncatedTo(ChronoUnit.MICROS);
            run.startedAt = run.opensAt;
            run.closesAt = now;
            run.closedAt = now;
            run.label = LocalDate.ofInstant(run.opensAt, ZoneOffset.UTC) + " – " + LocalDate.ofInstant(now, ZoneOffset.UTC);
            runs.persist(run);
            runs.flush();
        }
        responses.moveUnassignedAndReleaseQuotas(survey.id, id);
    }

    @Transactional
    public RunDto update(String userId, String surveyId, String runId, RunRequest req) {
        var survey = surveyService.requireEditable(userId, surveyId);
        var run = require(surveyId, runId);
        long count = responses.countBySession(surveyId, runId);
        var opensAt = req.opensAt() == null ? null : req.opensAt().truncatedTo(ChronoUnit.MICROS);
        if (!Objects.equals(opensAt, run.opensAt) && (run.snapshotAt != null || count > 0)) {
            throw RunException.conflict("RUN_STARTED", "A run's opening time can't change once it has opened.");
        }
        apply(survey, run, req);
        return toDto(run, count, Instant.now());
    }

    @Transactional
    public RunDto close(String userId, String surveyId, String runId) {
        surveyService.requireEditable(userId, surveyId);
        var run = require(surveyId, runId);
        if (run.closedAt == null) run.closedAt = Instant.now();
        return toDto(run, responses.countBySession(surveyId, runId), Instant.now());
    }

    @Transactional
    public RunDto duplicate(String userId, String surveyId, String runId, RunRequest req) {
        var survey = surveyService.requireEditable(userId, surveyId);
        require(surveyId, runId);
        return create(survey, req);
    }

    @Transactional
    public void delete(String userId, String surveyId, String runId) {
        var survey = surveyService.requireEditable(userId, surveyId);
        if (!surveyService.isOwner(userId, survey)) {
            throw new ForbiddenAccessException("Only the owner can delete a run.");
        }
        var run = require(surveyId, runId);
        if (responses.countBySession(surveyId, runId) > 0) {
            throw RunException.conflict("RUN_HAS_RESPONSES", "A run with responses can't be deleted.");
        }
        runs.delete(run);
    }

    public boolean hasRuns(Survey survey) {
        return !isLive(survey) && runs.hasScheduled(survey.id);
    }

    @Transactional
    public SurveyDto publicView(Survey survey, String runId) {
        if (!hasRuns(survey)) {
            SurveyAvailability.ensureOpen(survey, responses.countBySurvey(survey.id));
            return mapper.toDto(survey, false).withRuns(List.of(), null, false);
        }
        SurveyAvailability.ensureWithinWindow(survey);
        var now = Instant.now();
        var all = runs.findScheduled(survey.id);
        var visible = all.stream()
            .filter(run -> !"closed".equals(run.status(now)))
            .sorted(Comparator.comparing((LiveSession run) -> run.opensAt))
            .map(run -> toPublic(run, now))
            .toList();
        LiveSession requested = null;
        LiveSession served = null;
        if (runId != null && !runId.isBlank()) {
            requested = all.stream().filter(run -> run.id.equals(runId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Run not found."));
            if (requested.isOpen(now)) served = requested;
        } else {
            var open = all.stream().filter(run -> run.isOpen(now)).toList();
            if (open.size() == 1) served = open.get(0);
        }
        if (served == null) {
            return mapper.toDto(survey, false)
                .withRuns(visible, requested != null ? toPublic(requested, now) : null, true)
                .withoutContent();
        }
        ensureWithinLimit(survey, served);
        return mapper.toDto(content(survey, served), false).withRuns(visible, toPublic(served, now), true);
    }

    public LiveSession runForSubmit(Survey survey, String runId) {
        var now = Instant.now();
        var all = runs.findScheduled(survey.id);
        var open = all.stream().filter(run -> run.isOpen(now)).toList();
        if (runId != null && !runId.isBlank()) {
            return open.stream().filter(run -> run.id.equals(runId)).findFirst()
                .orElseThrow(() -> new RunException(409, "RUN_NOT_OPEN", "This run is not open.",
                    toPublic(open, now), nextOpensAt(all, now)));
        }
        if (open.size() == 1) return open.get(0);
        if (open.size() > 1) {
            throw new RunException(409, "RUN_REQUIRED", "Please choose which run you are answering.",
                toPublic(open, now), null);
        }
        var next = nextOpensAt(all, now);
        throw new RunException(403, "NO_OPEN_RUN",
            next != null ? "This survey is not open yet." : "This survey is closed.", null, next);
    }

    public LiveSession runForCheck(Survey survey, String runId) {
        var now = Instant.now();
        var all = runs.findScheduled(survey.id);
        if (runId != null && !runId.isBlank()) {
            return all.stream().filter(run -> run.id.equals(runId)).findFirst().orElse(null);
        }
        var open = all.stream().filter(run -> run.isOpen(now)).toList();
        return open.size() == 1 ? open.get(0) : null;
    }

    public void ensureWithinLimit(Survey survey, LiveSession run) {
        var limit = survey.settings != null ? survey.settings.responseLimit : null;
        if (limit != null && limit > 0 && responses.countBySession(survey.id, run.id) >= limit) {
            throw new ForbiddenAccessException("This survey has reached its response limit.");
        }
    }

    public Survey content(Survey survey, LiveSession run) {
        if (run.snapshot == null) takeSnapshot(survey, run);
        var content = mapper.fromSnapshot(survey, run.snapshot);
        var usage = responses.optionUsageInSession(survey.id, run.id, null);
        content.questions.forEach(q -> q.options.forEach(o -> o.used = usage.getOrDefault(o.id, 0L).intValue()));
        return content;
    }

    public Survey resultsContent(Survey master, String sessionId) {
        if (sessionId != null && !sessionId.isBlank()) return contentBySession(master).apply(sessionId);
        if (!hasRuns(master)) return master;
        var dto = mapper.toDto(master, true);
        var questions = new ArrayList<>(dto.questions());
        var known = new HashSet<String>();
        questions.forEach(q -> known.add(q.id()));
        int base = questions.size();
        for (var run : runs.findSnapshotted(master.id)) {
            for (var q : run.snapshot.questions() != null ? run.snapshot.questions() : List.<QuestionDto>of()) {
                if (known.add(q.id())) questions.add(q);
            }
        }
        return questions.size() == base ? master : mapper.fromSnapshot(master, dto.withQuestions(questions));
    }

    public void takeSnapshot(Survey survey, LiveSession run) {
        runs.getEntityManager().refresh(run, LockModeType.PESSIMISTIC_WRITE);
        if (run.snapshot != null) return;
        run.snapshot = mapper.toDto(survey, true);
        run.snapshotAt = Instant.now();
    }

    public Survey withoutContent(Survey survey) {
        return mapper.fromSnapshot(survey, mapper.toDto(survey, false).withoutContent());
    }

    public boolean isScheduledRun(String sessionId) {
        return sessionId != null && runs.findByIdOptional(sessionId).map(LiveSession::isScheduled).orElse(false);
    }

    public Function<String, Survey> contentBySession(Survey master) {
        Map<String, Survey> cache = new HashMap<>();
        return sessionId -> sessionId == null || sessionId.isBlank() ? master
            : cache.computeIfAbsent(sessionId, id -> runs.findByIdOptional(id)
                .filter(run -> run.surveyId.equals(master.id) && run.snapshot != null)
                .map(run -> mapper.fromSnapshot(master, run.snapshot))
                .orElse(master));
    }

    private void apply(Survey survey, LiveSession run, RunRequest req) {
        if (isLive(survey)) {
            throw new IllegalArgumentException("Live quizzes can't have scheduled runs.");
        }
        var label = req.label() == null ? "" : req.label().strip();
        if (label.isEmpty() || label.length() > MAX_LABEL_LENGTH) {
            throw new IllegalArgumentException("A run needs a name of at most " + MAX_LABEL_LENGTH + " characters.");
        }
        if (req.opensAt() == null || req.closesAt() == null || !req.opensAt().isBefore(req.closesAt())) {
            throw new IllegalArgumentException("A run must close after it opens.");
        }
        run.label = label;
        run.opensAt = req.opensAt().truncatedTo(ChronoUnit.MICROS);
        run.closesAt = req.closesAt().truncatedTo(ChronoUnit.MICROS);
        run.startedAt = run.opensAt;
    }

    private LiveSession require(String surveyId, String runId) {
        return runs.findScheduled(surveyId, runId)
            .orElseThrow(() -> new ResourceNotFoundException("Run not found."));
    }

    private static boolean isLive(Survey survey) {
        return survey.settings != null && survey.settings.liveMode;
    }

    private static String nextOpensAt(List<LiveSession> all, Instant now) {
        return all.stream()
            .filter(run -> "scheduled".equals(run.status(now)))
            .map(run -> run.opensAt)
            .min(Instant::compareTo)
            .map(Instant::toString)
            .orElse(null);
    }

    private static List<PublicRunDto> toPublic(List<LiveSession> list, Instant now) {
        return list.stream().map(run -> toPublic(run, now)).toList();
    }

    private static PublicRunDto toPublic(LiveSession run, Instant now) {
        return new PublicRunDto(run.id, run.label, str(run.opensAt), str(run.closesAt), run.status(now));
    }

    private static RunDto toDto(LiveSession run, long count, Instant now) {
        return new RunDto(run.id, run.label, str(run.opensAt), str(run.closesAt), str(run.closedAt),
            run.status(now), count, str(run.snapshotAt));
    }

    private static String str(Instant instant) {
        return instant != null ? instant.toString() : null;
    }
}
