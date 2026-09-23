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

    /** Open a new session for {@code surveyId}; answers from now on belong to it. Owner only. */
    @Transactional
    public LiveSessionDto start(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        var session = new LiveSession();
        session.id = UUID.randomUUID().toString();
        session.surveyId = surveyId;
        session.startedAt = Instant.now();
        sessions.persist(session);
        return new LiveSessionDto(session.id, session.startedAt.toString(), 0, 0);
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
        return responses.leaderboard(surveyId, current.get().id, capped).stream()
            .map(row -> new LeaderboardEntryDto((String) row[0], ((Number) row[1]).longValue()))
            .toList();
    }

    /** The survey's sessions, newest first, with answer and player counts. Owner only. */
    @Transactional
    public List<LiveSessionDto> list(String ownerId, String surveyId) {
        surveyService.requireOwner(ownerId, surveyId);
        var stats = new HashMap<String, long[]>();
        for (Object[] row : responses.sessionStats(surveyId)) {
            stats.put((String) row[0], new long[] {(Long) row[1], (Long) row[2]});
        }
        return sessions.findBySurvey(surveyId).stream()
            .map(s -> {
                var counts = stats.getOrDefault(s.id, new long[] {0, 0});
                return new LiveSessionDto(s.id, s.startedAt.toString(), counts[0], counts[1]);
            })
            .toList();
    }
}
