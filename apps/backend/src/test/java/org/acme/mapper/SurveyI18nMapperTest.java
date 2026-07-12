package org.acme.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;

import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.junit.jupiter.api.Test;

/**
 * Round-trips multilingual survey content (issue #37) through the mapper:
 * languages, default locale and the per-locale translation bag survive an
 * apply-update → to-DTO cycle, while single-language surveys stay untouched.
 */
class SurveyI18nMapperTest {

    private final SurveyMapper mapper = new SurveyMapper();

    @Test
    void translationsRoundTrip() {
        var s = new Survey();
        var i18n = Map.of(
            "en", Map.of("title", "Feedback", "question:q1:title", "Your name?"),
            "fr", Map.of("title", "Retour")
        );
        var req = new UpdateSurveyRequest(
            "Rückmeldung", "Hilf uns", SurveyStatus.PUBLISHED, null, null, null,
            List.of("de", "en", "fr"), "de", i18n
        );

        mapper.applyUpdate(s, req);
        var dto = mapper.toDto(s);

        assertEquals(List.of("de", "en", "fr"), dto.languages());
        assertEquals("de", dto.defaultLanguage());
        assertEquals("Feedback", dto.i18n().get("en").get("title"));
        assertEquals("Your name?", dto.i18n().get("en").get("question:q1:title"));
        assertEquals("Retour", dto.i18n().get("fr").get("title"));
        // Canonical fields are never overwritten by translations.
        assertEquals("Rückmeldung", dto.title());
    }

    @Test
    void singleLanguageSurveyHasNoTranslations() {
        var s = new Survey();
        var req = new UpdateSurveyRequest(
            "Plain", null, SurveyStatus.DRAFT, null, null, null,
            null, null, null
        );

        mapper.applyUpdate(s, req);
        var dto = mapper.toDto(s);

        assertTrue(dto.languages().isEmpty());
        assertNull(dto.defaultLanguage());
        assertNull(dto.i18n());
    }
}
