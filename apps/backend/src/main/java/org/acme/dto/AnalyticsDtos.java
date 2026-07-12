package org.acme.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

public final class AnalyticsDtos {

    private AnalyticsDtos() {}

    /** Beacon sent by the public pages — no cookies, no identifiers, no IP. */
    public record TrackRequest(
        @NotBlank String event,   // view | start | submit
        String referrer,
        String utmSource,
        String device
    ) {}

    public record CountEntry(String key, long count) {}

    public record AnalyticsDto(
        long views,
        long starts,
        long submits,
        List<CountEntry> sources,
        List<CountEntry> channels,
        List<CountEntry> devices,
        List<CountEntry> daily
    ) {}
}
