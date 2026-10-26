package org.acme.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.acme.dto.SurveyDtos.SurveySettingsDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;
import org.acme.entity.SurveyStatus;
import org.junit.jupiter.api.Test;

class SurveyPreviewSettingsMapperTest {

    private final SurveyMapper mapper = new SurveyMapper();
    private final ObjectMapper json = new ObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private SurveySettingsDto roundTrip(String settings) throws Exception {
        var survey = new Survey();
        mapper.applyUpdate(survey, new UpdateSurveyRequest(
            "Title", null, SurveyStatus.DRAFT, json.readValue(settings, SurveySettingsDto.class),
            null, null, null, null, null));
        return mapper.toDto(survey).settings();
    }

    @Test
    void keepsTheChosenPreviewDesign() throws Exception {
        var settings = roundTrip(
            "{\"ogStyle\":\"spotlight\",\"ogShowQuestion\":false,\"ogShowTitle\":false,\"ogShowDescription\":true}");
        assertEquals("spotlight", settings.ogStyle());
        assertEquals(Boolean.FALSE, settings.ogShowQuestion());
        assertEquals(Boolean.FALSE, settings.ogShowTitle());
        assertEquals(Boolean.TRUE, settings.ogShowDescription());
    }

    @Test
    void dropsUnknownPreviewDesigns() throws Exception {
        assertNull(roundTrip("{\"ogStyle\":\"<script>\"}").ogStyle());
        assertNull(roundTrip("{}").ogStyle());
    }

    @Test
    void keepsStoredPreviewChoicesWhenAnOlderClientSaves() throws Exception {
        var survey = new Survey();
        mapper.applyUpdate(survey, new UpdateSurveyRequest("Title", null, SurveyStatus.DRAFT,
            json.readValue("{\"ogStyle\":\"split\",\"ogShowTitle\":false}", SurveySettingsDto.class),
            null, null, null, null, null));
        mapper.applyUpdate(survey, new UpdateSurveyRequest("Title", null, SurveyStatus.DRAFT,
            json.readValue("{\"accentColor\":\"#00ff00\"}", SurveySettingsDto.class),
            null, null, null, null, null));

        assertEquals("split", survey.settings.ogStyle);
        assertEquals(Boolean.FALSE, survey.settings.ogShowTitle);
        assertEquals("#00ff00", survey.settings.accentColor);
    }

    @Test
    void readsSettingsWrittenByANewerVersion() throws Exception {
        var strict = new ObjectMapper();
        var stored = strict.readValue("{\"accentColor\":\"#ff0000\",\"futureOption\":42}", SurveySettings.class);
        assertEquals("#ff0000", stored.accentColor);
    }

    @Test
    void readsSettingsStoredBeforePreviewOptionsExisted() throws Exception {
        var survey = new Survey();
        survey.settings = json.readValue(
            "{\"accentColor\":\"#ff0000\",\"isQuiz\":true,\"colorPalette\":[\"#000000\"]}", SurveySettings.class);
        var dto = mapper.toDto(survey);
        var settings = dto.settings();
        assertEquals("#ff0000", settings.accentColor());
        assertTrue(settings.isQuiz());
        assertEquals(List.of("#000000"), settings.colorPalette());
        assertNull(settings.ogStyle());
        assertNull(settings.ogShowTitle());
        assertNull(settings.ogShowQuestion());
        assertNull(settings.ogShowOwner());
        assertNull(dto.ownerName());
    }
}
