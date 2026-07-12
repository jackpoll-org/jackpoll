package org.acme.service;

import java.net.URI;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.acme.dto.AnalyticsDtos.AnalyticsDto;
import org.acme.dto.AnalyticsDtos.CountEntry;
import org.acme.dto.AnalyticsDtos.TrackRequest;
import org.acme.entity.AnalyticsCounter;
import org.acme.entity.SurveyStatus;
import org.acme.exception.ResourceNotFoundException;
import org.acme.repository.AnalyticsRepository;
import org.acme.repository.SurveyRepository;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/**
 * Cookieless, aggregate-only survey analytics (issue #34). Stores no cookies,
 * no IP addresses and no per-visitor records — only incrementing counters.
 */
@ApplicationScoped
public class AnalyticsService {

    @Inject
    SurveyService surveyService;

    @Inject
    SurveyRepository surveys;

    @Inject
    AnalyticsRepository counters;

    // ── Public tracking beacon ────────────────────────────────────

    @Transactional
    public void track(String surveyId, TrackRequest req) {
        var published = surveys.findByIdOptional(surveyId)
            .filter(s -> s.status == SurveyStatus.PUBLISHED)
            .isPresent();
        if (!published) {
            return; // silently ignore tracking for non-public surveys
        }

        var event = req.event() == null ? "" : req.event().toLowerCase();
        if (!event.equals("view") && !event.equals("start") && !event.equals("submit")) {
            return;
        }

        increment(surveyId, "stage", event);
        if (event.equals("view")) {
            increment(surveyId, "source", normalizeReferrer(req.referrer()));
            increment(surveyId, "channel", normalizeChannel(req.utmSource()));
            increment(surveyId, "device", normalizeDevice(req.device()));
            increment(surveyId, "day", LocalDate.now().toString());
        }
    }

    // ── Owner read ────────────────────────────────────────────────

    public AnalyticsDto getAnalytics(String userId, String surveyId) {
        surveyService.requireReadable(userId, surveyId);
        var all = counters.findBySurvey(surveyId);

        return new AnalyticsDto(
            stage(all, "view"),
            stage(all, "start"),
            stage(all, "submit"),
            entries(all, "source"),
            entries(all, "channel"),
            entries(all, "device"),
            daily(all));
    }

    // ── Helpers ───────────────────────────────────────────────────

    private void increment(String surveyId, String dimension, String key) {
        var safeKey = (key == null || key.isBlank()) ? "unknown" : key;
        if (safeKey.length() > 120) safeKey = safeKey.substring(0, 120);
        final var k = safeKey;
        var counter = counters.find(surveyId, dimension, k).orElse(null);
        if (counter == null) {
            counter = new AnalyticsCounter();
            counter.id = UUID.randomUUID().toString();
            counter.surveyId = surveyId;
            counter.dimension = dimension;
            counter.key = k;
            counter.count = 0;
            counters.persist(counter);
        }
        counter.count++;
    }

    private static long stage(List<AnalyticsCounter> all, String key) {
        return all.stream()
            .filter(c -> c.dimension.equals("stage") && c.key.equals(key))
            .mapToLong(c -> c.count)
            .findFirst()
            .orElse(0);
    }

    private static List<CountEntry> entries(List<AnalyticsCounter> all, String dimension) {
        return all.stream()
            .filter(c -> c.dimension.equals(dimension))
            .sorted(Comparator.comparingLong((AnalyticsCounter c) -> c.count).reversed())
            .map(c -> new CountEntry(c.key, c.count))
            .toList();
    }

    private static List<CountEntry> daily(List<AnalyticsCounter> all) {
        return all.stream()
            .filter(c -> c.dimension.equals("day"))
            .sorted(Comparator.comparing(c -> c.key))
            .map(c -> new CountEntry(c.key, c.count))
            .toList();
    }

    /** Referrer reduced to its host only (no path/query) — avoids storing PII. */
    private static String normalizeReferrer(String referrer) {
        if (referrer == null || referrer.isBlank()) return "direct";
        try {
            var host = URI.create(referrer).getHost();
            if (host == null || host.isBlank()) return "direct";
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (IllegalArgumentException e) {
            return "other";
        }
    }

    private static String normalizeChannel(String utmSource) {
        return (utmSource == null || utmSource.isBlank())
            ? "direct"
            : utmSource.trim().toLowerCase();
    }

    private static String normalizeDevice(String device) {
        if (device == null) return "unknown";
        return switch (device.toLowerCase()) {
            case "mobile", "tablet", "desktop" -> device.toLowerCase();
            default -> "unknown";
        };
    }
}
