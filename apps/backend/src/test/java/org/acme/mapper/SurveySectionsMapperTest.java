package org.acme.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.acme.dto.SurveyDtos.QuestionDto;
import org.acme.dto.SurveyDtos.SectionDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.QuestionType;
import org.acme.entity.Section;
import org.acme.entity.Survey;
import org.acme.entity.SurveyStatus;
import org.junit.jupiter.api.Test;

class SurveySectionsMapperTest {

    private final SurveyMapper mapper = new SurveyMapper();

    private static QuestionDto question(String id, String sectionId) {
        return new QuestionDto(id, QuestionType.SHORT_ANSWER, id, null, false, 0,
            null, null, null, null, null, null, null, null, sectionId);
    }

    private static UpdateSurveyRequest update(List<QuestionDto> questions, List<SectionDto> sections) {
        return new UpdateSurveyRequest("Title", null, SurveyStatus.DRAFT, null,
            questions, sections, null, null, null);
    }

    private static List<String> ids(List<Section> sections) {
        return sections.stream().map(s -> s.id).toList();
    }

    @Test
    void keepsStoredSectionsWhenAnUpdateSendsNone() {
        var survey = new Survey();
        var questions = List.of(question("q1", null), question("q2", "reflexion"));
        mapper.applyUpdate(survey, update(questions,
            List.of(new SectionDto("reflexion", "Reflexion", null, 0, null))));

        mapper.applyUpdate(survey, update(questions, null));

        assertEquals(List.of("reflexion"), ids(survey.sections));
        assertEquals("Reflexion", survey.sections.get(0).title);
    }

    @Test
    void recoversSectionsThatQuestionsStillReferToOnSave() {
        var survey = new Survey();
        mapper.applyUpdate(survey, update(
            List.of(question("q1", "b"), question("q2", "a"), question("q3", "b")),
            List.of(new SectionDto("a", "First", null, 0, null))));

        assertEquals(List.of("a", "b"), ids(survey.sections));
        assertEquals("First", survey.sections.get(0).title);
        assertNull(survey.sections.get(1).title);
        assertEquals(1, survey.sections.get(1).order);
    }

    @Test
    void numbersRecoveredSectionsAfterTheHighestStoredOrder() {
        var survey = new Survey();
        var kept = new Section();
        kept.id = "kept";
        kept.order = 5;
        survey.sections = new java.util.ArrayList<>(List.of(kept));

        mapper.applyUpdate(survey, update(
            List.of(question("q1", "kept"), question("q2", "lost-1"), question("q3", "lost-2")), null));

        assertEquals(List.of("kept", "lost-1", "lost-2"), ids(survey.sections));
        assertEquals(List.of(5, 6, 7), survey.sections.stream().map(x -> x.order).toList());
    }
}
