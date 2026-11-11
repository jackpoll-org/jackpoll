package org.acme.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.acme.dto.SurveyDtos.OptionDto;
import org.acme.entity.OptionKind;
import org.acme.entity.Question;
import org.acme.entity.QuestionOption;
import org.acme.entity.QuestionType;
import org.acme.entity.Survey;
import org.junit.jupiter.api.Test;

class SurveyAnswerKeyMapperTest {

    private final SurveyMapper mapper = new SurveyMapper();

    private static Survey surveyWith(Question q) {
        var survey = new Survey();
        survey.settings = org.acme.entity.SurveySettings.defaults();
        survey.settings.isQuiz = true;
        survey.questions.add(q);
        return survey;
    }

    private static Question question(QuestionType type, Map<String, Object> settings, String... optionIds) {
        var q = new Question();
        q.id = "q-" + type;
        q.type = type;
        q.settings = settings;
        q.options = new ArrayList<>();
        for (int i = 0; i < optionIds.length; i++) {
            var o = new QuestionOption();
            o.id = optionIds[i];
            o.label = optionIds[i];
            o.kind = OptionKind.OPTION;
            o.order = i;
            q.options.add(o);
        }
        return q;
    }

    @Test
    void respondentsNeverSeeOptionOrAnswerPoints() {
        var choice = question(QuestionType.CHECKBOXES,
            Map.of("optionPoints", Map.of("a", 1, "b", -1), "maxWords", 3), "a", "b");
        var shortAnswer = question(QuestionType.SHORT_ANSWER, Map.of("answerPoints", Map.of("Berlin", 2)));

        var publicChoice = mapper.toDto(surveyWith(choice), false).questions().get(0).settings();
        var publicShort = mapper.toDto(surveyWith(shortAnswer), false).questions().get(0).settings();

        assertFalse(publicChoice.containsKey("optionPoints"));
        assertEquals(3, publicChoice.get("maxWords"));
        assertFalse(publicShort.containsKey("answerPoints"));
        assertEquals(1, mapper.toDto(surveyWith(choice), false).questions().get(0).points());
        assertEquals(Map.of("a", 1, "b", -1), mapper.toDto(surveyWith(choice), true).questions().get(0).settings().get("optionPoints"));
    }

    @Test
    void aScoredOrderReachesRespondentsShuffled() {
        var scored = question(QuestionType.RANKING, Map.of("scoreOrder", true), "1", "2", "3", "4");

        var seen = new java.util.HashSet<List<String>>();
        for (int i = 0; i < 30; i++) {
            var shown = ids(mapper.toDto(surveyWith(scored), false).questions().get(0).options());
            assertEquals(List.of("1", "2", "3", "4"), shown.stream().sorted().toList());
            seen.add(shown);
        }

        assertNotEquals(1, seen.size());
        assertEquals(List.of("1", "2", "3", "4"), ids(mapper.toDto(surveyWith(scored), true).questions().get(0).options()));
    }

    @Test
    void aSurveyThatIsNoLongerAQuizKeepsTheOrder() {
        var scored = question(QuestionType.RANKING, Map.of("scoreOrder", true), "1", "2", "3", "4");
        var survey = surveyWith(scored);
        survey.settings.isQuiz = false;
        for (int i = 0; i < 10; i++) {
            assertEquals(List.of("1", "2", "3", "4"), ids(mapper.toDto(survey, false).questions().get(0).options()));
        }
    }

    @Test
    void anUnscoredRankingKeepsItsOrder() {
        var opinion = question(QuestionType.RANKING, null, "1", "2", "3");
        assertEquals(List.of("1", "2", "3"), ids(mapper.toDto(surveyWith(opinion), false).questions().get(0).options()));
    }

    private static List<String> ids(List<OptionDto> options) {
        return options.stream().map(OptionDto::id).toList();
    }
}
