package org.acme.service;

import java.util.Map;

import org.acme.resource.ResultsRelay;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Presenter-paced live mode (#): the survey owner drives everyone through the
 * questions one at a time. The current position is broadcast to participants
 * over the existing results WebSocket ({@code /results-ws}) as a small JSON
 * control message {@code {"live":{"index":N,"phase":"..."}}}, so no new socket
 * or Traefik route is needed.
 */
@ApplicationScoped
public class LivePresentService {

    @Inject
    SurveyService surveyService;

    @Inject
    ResultsRelay relay;

    @Inject
    ObjectMapper objectMapper;

    /** Broadcast the presenter's current question index + phase. Owner only. */
    public void setState(String ownerId, String surveyId, int index, String phase) {
        surveyService.requireOwner(ownerId, surveyId);
        try {
            var msg = objectMapper.writeValueAsString(Map.of(
                "live", Map.of(
                    "index", Math.max(0, index),
                    "phase", phase == null || phase.isBlank() ? "question" : phase)));
            relay.broadcast(surveyId, msg);
        } catch (Exception e) {
            // Best-effort: a broadcast failure must not fail the presenter's action.
        }
    }

    /**
     * Broadcast a participant's lobby check-in as {@code {"join":{"name":...}}}
     * so the presenter can list who has joined. Anonymous + best-effort.
     */
    public void announceJoin(String surveyId, String name) {
        if (name == null || name.isBlank()) return;
        var clean = name.trim();
        if (clean.length() > 60) clean = clean.substring(0, 60);
        try {
            var msg = objectMapper.writeValueAsString(Map.of("join", Map.of("name", clean)));
            relay.broadcast(surveyId, msg);
        } catch (Exception e) {
            // Best-effort: a broadcast failure must not fail the participant's join.
        }
    }
}
