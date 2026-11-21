package org.acme.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import org.acme.dto.ResponseDtos.LeaderboardEntryDto;
import org.acme.dto.ResponseDtos.LiveSessionDto;
import org.acme.entity.LiveSession;
import org.acme.repository.LiveSessionRepository;
import org.acme.repository.ResponseRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Live quiz sessions: the presenter opens one each time it starts the game.
 * Answers are tagged with the current session in ResponseService.submit, so a
 * restarted quiz shows only its own players, scores and podium.
 */
@ApplicationScoped
public class LiveSessionService {

    @Inject
    SurveyService surveyService;

    @Inject
    LiveSessionRepository sessions;

    @Inject
    ResponseRepository responses;

    @Inject
    SurveyRepository surveys;

    @Inject
    LivePresentService livePresent;

    /** Open a new session for {@code surveyId}; answers from now on belong to it. Owner only. */
    @Transactional
    public LiveSessionDto start(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        var session = new LiveSession();
        session.id = UUID.randomUUID().toString();
        session.surveyId = surveyId;
        session.startedAt = Instant.now();
        sessions.persist(session);
        return new LiveSessionDto(session.id, session.startedAt.toString(), 0, 0, session.kind, null, null, null);
    }

    private static final int MAX_LEADERBOARD = 50;

    /**
     * The current session's leaderboard: each nickname's total score, best
     * first. Public — players see it on their phones — and limited to the
     * running game, so earlier games' players never show up. Empty until the
     * first session starts.
     */
    @Transactional
    public List<LeaderboardEntryDto> leaderboard(String surveyId, int limit) {
        var current = sessions.findCurrent(surveyId);
        if (current.isEmpty()) return List.of();
        int capped = Math.max(1, Math.min(limit, MAX_LEADERBOARD));
        var shown = livePresent.getState(surveyId);
        if (shown == null) return List.of();
        var slides = surveys.findPageLayout(surveyId).map(SurveyPages::questionsInPageOrder).orElse(List.of());
        boolean shownClosed = "reveal".equals(shown.phase()) || "results".equals(shown.phase());
        int firstHidden = Math.min(slides.size(), shownClosed ? shown.index() + 1 : shown.index());
        var hidden = slides.subList(firstHidden, slides.size()).stream().map(q -> q.id).toList();
        return responses.leaderboard(surveyId, current.get().id, hidden, capped).stream()
            .map(row -> new LeaderboardEntryDto((String) row[0], ((Number) row[1]).longValue()))
            .toList();
    }

    /** The survey's sessions, newest first, with answer and player counts. */
    @Transactional
    public List<LiveSessionDto> list(String userId, String surveyId) {
        var survey = surveyService.requireReadable(userId, surveyId);
        boolean live = survey.settings != null && survey.settings.liveMode;
        var stats = new HashMap<String, long[]>();
        for (Object[] row : responses.sessionStats(surveyId)) {
            stats.put((String) row[0], new long[] {(Long) row[1], (Long) row[2]});
        }
        return sessions.findBySurvey(surveyId).stream()
            .filter(s -> !live || !s.isScheduled())
            .map(s -> {
                var counts = stats.getOrDefault(s.id, new long[] {0, 0});
                return new LiveSessionDto(s.id, s.startedAt.toString(), counts[0], counts[1], s.kind, s.label,
                    s.opensAt != null ? s.opensAt.toString() : null, s.closesAt != null ? s.closesAt.toString() : null);
            })
            .toList();
    }
}
