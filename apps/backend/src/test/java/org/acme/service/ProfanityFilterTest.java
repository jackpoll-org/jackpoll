package org.acme.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Pure unit tests for the wordcloud profanity gate (no container needed). */
class ProfanityFilterTest {

    private final ProfanityFilter filter = new ProfanityFilter();

    @Test
    void flagsProfaneWordsRegardlessOfCasingAndPunctuation() {
        assertTrue(filter.isProfane("shit"));
        assertTrue(filter.isProfane("SHIT"));
        assertTrue(filter.isProfane("f.u.c.k"));
        assertTrue(filter.isProfane("$h1t"));
        assertTrue(filter.isProfane("Scheisse"));
        assertTrue(filter.isProfane("arschloch"));
    }

    @Test
    void doesNotFlagCleanWordsThatContainRudeSubstrings() {
        // Scunthorpe problem — exact match only, never substring.
        assertFalse(filter.isProfane("class"));
        assertFalse(filter.isProfane("assume"));
        assertFalse(filter.isProfane("as"));
        assertFalse(filter.isProfane("hello"));
        assertFalse(filter.isProfane("analysis"));
        assertFalse(filter.isProfane(""));
        assertFalse(filter.isProfane(null));
    }
}
