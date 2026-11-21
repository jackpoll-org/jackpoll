package org.acme.dto;

import java.time.Instant;

public final class RunDtos {

    private RunDtos() {}

    public record RunRequest(
        String label,
        Instant opensAt,
        Instant closesAt
    ) {}

    public record RunDto(
        String id,
        String label,
        String opensAt,
        String closesAt,
        String closedAt,
        String status,
        long responseCount,
        String snapshotAt
    ) {}

    public record PublicRunDto(
        String id,
        String label,
        String opensAt,
        String closesAt,
        String status
    ) {}
}
