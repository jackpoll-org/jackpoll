package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.acme.resource.ResultsRelay;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.quarkus.redis.datasource.RedisDataSource;
import jakarta.enterprise.inject.Instance;

/**
 * Pure unit tests for LivePresentService's resync cache (participants poll
 * this as a fallback when their WebSocket may have missed a broadcast). Uses
 * an unsatisfied Redis Instance so it exercises the memory-only fallback — no
 * Quarkus boot or database required, mirroring SurveyServiceTest's approach.
 */
class LivePresentServiceTest {

    private ResultsRelay relay;
    private LivePresentService service;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        Instance<RedisDataSource> redis = mock(Instance.class);
        when(redis.isUnsatisfied()).thenReturn(true);

        relay = mock(ResultsRelay.class);

        service = new LivePresentService();
        service.surveyService = mock(SurveyService.class);
        service.relay = relay;
        service.objectMapper = new ObjectMapper();
        service.redis = redis;
    }

    @Test
    void getStateReturnsNullBeforeAnyBroadcast() {
        assertNull(service.getState("survey-1"));
    }

    @Test
    void setStateCachesAndBroadcastsTheLastState() {
        service.setState("owner-1", "survey-1", 2, "reveal");

        var state = service.getState("survey-1");
        assertEquals(2, state.index());
        assertEquals("reveal", state.phase());
        verify(relay).broadcast(anyString(), anyString());
    }

    @Test
    void setStateDefaultsBlankPhaseToQuestion() {
        service.setState("owner-1", "survey-1", 0, "  ");
        assertEquals("question", service.getState("survey-1").phase());
    }

    @Test
    void setStateClampsNegativeIndexToZero() {
        service.setState("owner-1", "survey-1", -5, "lobby");
        assertEquals(0, service.getState("survey-1").index());
    }

    @Test
    void differentSurveysHaveIndependentState() {
        service.setState("owner-1", "survey-a", 1, "question");
        service.setState("owner-1", "survey-b", 9, "results");
        assertEquals(1, service.getState("survey-a").index());
        assertEquals(9, service.getState("survey-b").index());
    }
}
