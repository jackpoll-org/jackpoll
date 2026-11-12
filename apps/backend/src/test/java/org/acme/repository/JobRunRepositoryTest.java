package org.acme.repository;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;

@QuarkusTest
class JobRunRepositoryTest {

    @Inject
    JobRunRepository jobRuns;

    @Test
    void onlyTheFirstClaimOfADayWins() {
        String job = "test-" + UUID.randomUUID();
        LocalDate day = LocalDate.of(2026, 1, 1);

        assertTrue(jobRuns.claim(job, day));
        assertFalse(jobRuns.claim(job, day));
        assertFalse(jobRuns.claim(job, day.minusDays(1)));
        assertTrue(jobRuns.claim(job, day.plusDays(1)));
    }
}
