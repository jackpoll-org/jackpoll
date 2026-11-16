package org.acme.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;

import org.acme.entity.Question;
import org.acme.entity.Section;
import org.acme.entity.Survey;

// Mirrors buildAllPages/questionsInPageOrder in apps/frontend/app/lib/survey/pagination.ts;
// both must pass apps/frontend/app/lib/survey/__tests__/fixtures/page-order.json.
public final class SurveyPages {

    public record Page(String title, String description, List<Question> questions) {}

    private SurveyPages() {}

    public static List<Question> questionsInPageOrder(Survey survey) {
        return pages(survey).stream().flatMap(page -> page.questions().stream()).toList();
    }

    public static List<Page> pages(Survey survey) {
        var pages = layout(survey);
        var placed = new HashSet<String>();
        pages.forEach(page -> page.questions().forEach(q -> placed.add(q.id)));
        var unplaced = survey.questions.stream().filter(q -> !placed.contains(q.id)).toList();
        if (!unplaced.isEmpty()) pages.add(new Page(null, null, unplaced));
        return pages;
    }

    private static List<Page> layout(Survey survey) {
        var questions = survey.questions;
        var pages = new ArrayList<Page>();
        if (survey.settings != null && survey.settings.conversational) {
            questions.forEach(q -> pages.add(new Page(null, null, List.of(q))));
            return pages;
        }
        var sections = survey.sections == null ? List.<Section>of()
            : survey.sections.stream().sorted(Comparator.comparingInt(s -> s.order)).toList();
        var firstTitle = blankToNull(survey.settings == null ? null : survey.settings.firstPageTitle);
        var firstDescription = blankToNull(survey.settings == null ? null : survey.settings.firstPageDescription);
        if (sections.isEmpty()) {
            pages.add(new Page(firstTitle, firstDescription, List.copyOf(questions)));
            return pages;
        }
        var ungrouped = new ArrayList<Question>();
        var bySection = new java.util.HashMap<String, List<Question>>();
        for (var q : questions) {
            var key = sectionKey(q.sectionId);
            if (key == null) ungrouped.add(q);
            else bySection.computeIfAbsent(key, k -> new ArrayList<>()).add(q);
        }
        if (!ungrouped.isEmpty()) pages.add(new Page(firstTitle, firstDescription, ungrouped));
        for (var section : sections) {
            if (sectionKey(section.id) == null) continue;
            var inSection = bySection.get(section.id);
            if (inSection != null) pages.add(new Page(section.title, section.description, inSection));
        }
        return pages;
    }

    public static String sectionKey(String sectionId) {
        return sectionId == null || sectionId.chars().allMatch(SurveyPages::isAsciiSpace) ? null : sectionId;
    }

    private static boolean isAsciiSpace(int c) {
        return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == 0x0B;
    }

    private static String blankToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }
}
