package org.acme.mapper;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.acme.dto.SurveyDtos.OptionDto;
import org.acme.dto.SurveyDtos.QuestionDto;
import org.acme.dto.SurveyDtos.SectionDto;
import org.acme.dto.SurveyDtos.SurveyDto;
import org.acme.dto.SurveyDtos.SurveySettingsDto;
import org.acme.dto.SurveyDtos.UpdateSurveyRequest;
import org.acme.entity.OptionKind;
import org.acme.entity.Question;
import org.acme.entity.QuestionOption;
import org.acme.entity.Section;
import org.acme.entity.Survey;
import org.acme.entity.SurveySettings;

import jakarta.enterprise.context.ApplicationScoped;

/**
 * Manual entity &lt;-&gt; DTO mapping for surveys. Kept manual (no MapStruct) to
 * match the project's existing style and to control the option/grid splitting.
 */
@ApplicationScoped
public class SurveyMapper {

    // ── Entity → DTO ──────────────────────────────────────────────

    public SurveyDto toDto(Survey s) {
        return toDto(s, true);
    }

    /**
     * @param includeAnswers when false, quiz correct answers are omitted — used
     *                       for the public/embed payload so respondents can't see them.
     */
    public SurveyDto toDto(Survey s, boolean includeAnswers) {
        return new SurveyDto(
            s.id,
            s.ownerId,
            s.title,
            s.description,
            s.status,
            toSettingsDto(s.settings),
            s.questions.stream().map(q -> toQuestionDto(q, includeAnswers)).toList(),
            toSectionDtos(s.sections),
            s.tags != null ? s.tags : java.util.List.of(),
            s.folderId,
            s.sortPosition,
            s.languages != null ? s.languages : java.util.List.of(),
            s.defaultLanguage,
            s.i18n,
            s.createdAt != null ? s.createdAt.toString() : null,
            s.updatedAt != null ? s.updatedAt.toString() : null
        );
    }

    private SurveySettingsDto toSettingsDto(SurveySettings v) {
        var s = v != null ? v : SurveySettings.defaults();
        return new SurveySettingsDto(
            s.allowMultipleResponses,
            s.confirmationMessage,
            s.redirectUrl,
            s.showProgressBar,
            s.shuffleQuestions,
            s.isQuiz,
            s.timeLimit,
            s.passingScore,
            s.showCorrectAnswers,
            s.opensAt,
            s.closesAt,
            s.responseLimit,
            s.showLiveResults,
            s.postSubmitSummary,
            s.accentColor,
            s.backgroundColor,
            s.logoUrl,
            s.headerImageUrl,
            s.showPoweredBy,
            s.minSubmitSeconds,
            s.rateLimit,
            s.onePerBrowser,
            s.requireCaptcha,
            s.ownerNotify,
            s.respondentReceipts,
            s.allowEditResponses,
            s.conversational,
            s.outcomes == null ? null : s.outcomes.stream()
                .map(o -> new org.acme.dto.SurveyDtos.OutcomeDto(
                    o.id, o.title, o.description, o.imageUrl, o.minScore, o.maxScore))
                .toList(),
            s.retentionDays,
            s.retentionAnonymize,
            s.privacyNotice,
            s.requireConsent,
            s.requireRespondentName,
            s.liveMode,
            s.liveQuestionSeconds,
            s.firstPageTitle,
            s.firstPageDescription
        );
    }

    private QuestionDto toQuestionDto(Question q, boolean includeAnswers) {
        return new QuestionDto(
            q.id,
            q.type,
            q.title,
            q.description,
            q.required,
            q.order,
            optionsOfKind(q, OptionKind.OPTION),
            optionsOfKind(q, OptionKind.ROW),
            optionsOfKind(q, OptionKind.COLUMN),
            q.settings,
            q.points,
            includeAnswers ? q.correctAnswers : null,
            q.showInLiveResults,
            q.sectionId
        );
    }

    private List<SectionDto> toSectionDtos(List<Section> sections) {
        if (sections == null || sections.isEmpty()) return java.util.List.of();
        return sections.stream()
            .map(s -> new SectionDto(s.id, s.title, s.description, s.order, s.visibleIf))
            .toList();
    }

    private List<OptionDto> optionsOfKind(Question q, OptionKind kind) {
        var list = q.options.stream()
            .filter(o -> o.kind == kind)
            .map(o -> new OptionDto(o.id, o.label, o.capacity, o.used))
            .toList();
        return list.isEmpty() ? null : list;
    }

    // ── Request → Entity ──────────────────────────────────────────

    /** Applies a full-update request onto an existing (managed) survey entity. */
    public void applyUpdate(Survey s, UpdateSurveyRequest req) {
        s.title = req.title();
        s.description = req.description();
        s.status = req.status();
        s.settings = fromSettingsDto(req.settings());
        s.sections = fromSectionDtos(req.sections());
        // Multilingual content (issue #37) — stored verbatim; ids stay stable.
        s.languages = req.languages() != null ? req.languages() : new ArrayList<>();
        s.defaultLanguage = req.defaultLanguage();
        s.i18n = req.i18n();

        // Remove questions that are no longer in the request
        var incomingIds = new java.util.HashSet<String>();
        if (req.questions() != null) {
            for (var qd : req.questions()) {
                if (qd.id() != null) {
                    incomingIds.add(qd.id());
                }
            }
        }
        s.questions.removeIf(q -> !incomingIds.contains(q.id));

        // Map remaining existing questions by ID
        var existingQuestions = new java.util.HashMap<String, Question>();
        for (var q : s.questions) {
            existingQuestions.put(q.id, q);
        }

        // Rebuild the ordered list of questions
        var orderedQuestions = new ArrayList<Question>();
        if (req.questions() != null) {
            var order = 0;
            for (var qd : req.questions()) {
                Question q;
                if (qd.id() != null && existingQuestions.containsKey(qd.id())) {
                    q = existingQuestions.get(qd.id());
                    updateQuestionFromDto(q, qd, order++);
                } else {
                    q = new Question();
                    q.id = qd.id() != null ? qd.id() : UUID.randomUUID().toString();
                    q.survey = s;
                    q.options = new ArrayList<>();
                    updateQuestionFromDto(q, qd, order++);
                }
                orderedQuestions.add(q);
            }
        }

        s.questions.clear();
        s.questions.addAll(orderedQuestions);
    }

    private SurveySettings fromSettingsDto(SurveySettingsDto d) {
        if (d == null) {
            return SurveySettings.defaults();
        }
        var s = new SurveySettings();
        s.allowMultipleResponses = d.allowMultipleResponses();
        s.confirmationMessage = d.confirmationMessage();
        s.redirectUrl = d.redirectUrl();
        s.showProgressBar = d.showProgressBar();
        s.shuffleQuestions = d.shuffleQuestions();
        s.isQuiz = d.isQuiz();
        s.timeLimit = d.timeLimit();
        s.passingScore = d.passingScore();
        s.showCorrectAnswers = d.showCorrectAnswers();
        s.opensAt = d.opensAt();
        s.closesAt = d.closesAt();
        s.responseLimit = d.responseLimit();
        s.showLiveResults = d.showLiveResults();
        s.postSubmitSummary = d.postSubmitSummary();
        s.accentColor = d.accentColor();
        s.backgroundColor = d.backgroundColor();
        s.logoUrl = d.logoUrl();
        s.headerImageUrl = d.headerImageUrl();
        s.showPoweredBy = d.showPoweredBy();
        s.minSubmitSeconds = d.minSubmitSeconds();
        s.rateLimit = d.rateLimit();
        s.onePerBrowser = d.onePerBrowser();
        s.requireCaptcha = d.requireCaptcha();
        s.ownerNotify = d.ownerNotify();
        s.respondentReceipts = d.respondentReceipts();
        s.allowEditResponses = d.allowEditResponses();
        s.conversational = d.conversational();
        s.outcomes = d.outcomes() == null ? null : d.outcomes().stream()
            .map(o -> {
                var x = new org.acme.entity.Outcome();
                x.id = o.id();
                x.title = o.title();
                x.description = o.description();
                x.imageUrl = o.imageUrl();
                x.minScore = o.minScore();
                x.maxScore = o.maxScore();
                return x;
            })
            .toList();
        s.retentionDays = d.retentionDays();
        s.retentionAnonymize = d.retentionAnonymize();
        s.privacyNotice = d.privacyNotice();
        s.requireConsent = d.requireConsent();
        s.requireRespondentName = d.requireRespondentName();
        s.liveMode = d.liveMode();
        s.liveQuestionSeconds = d.liveQuestionSeconds();
        s.firstPageTitle = d.firstPageTitle();
        s.firstPageDescription = d.firstPageDescription();
        return s;
    }

    private List<Section> fromSectionDtos(List<SectionDto> dtos) {
        var out = new ArrayList<Section>();
        if (dtos == null) return out;
        var order = 0;
        for (var d : dtos) {
            var s = new Section();
            s.id = d.id() != null ? d.id() : UUID.randomUUID().toString();
            s.title = d.title();
            s.description = d.description();
            s.order = order++;
            s.visibleIf = d.visibleIf();
            out.add(s);
        }
        return out;
    }

    private void updateQuestionFromDto(Question q, QuestionDto d, int order) {
        q.type = d.type();
        q.title = d.title();
        q.description = d.description();
        q.required = d.required();
        q.order = order;
        q.settings = d.settings();
        q.points = d.points();
        q.correctAnswers = d.correctAnswers();
        q.showInLiveResults = d.showInLiveResults();
        q.sectionId = d.sectionId();

        mergeOptions(q, d.options(), OptionKind.OPTION);
        mergeOptions(q, d.rows(), OptionKind.ROW);
        mergeOptions(q, d.columns(), OptionKind.COLUMN);
    }

    private Question fromQuestionDto(QuestionDto d, Survey survey, int order) {
        var q = new Question();
        q.id = d.id() != null ? d.id() : UUID.randomUUID().toString();
        q.survey = survey;
        q.options = new ArrayList<>();
        updateQuestionFromDto(q, d, order);
        return q;
    }

    private void mergeOptions(Question q, List<OptionDto> dtos, OptionKind kind) {
        if (dtos == null) {
            q.options.removeIf(o -> o.kind == kind);
            return;
        }

        var incomingIds = new java.util.HashSet<String>();
        for (var od : dtos) {
            if (od.id() != null) {
                incomingIds.add(od.id());
            }
        }

        q.options.removeIf(o -> o.kind == kind && !incomingIds.contains(o.id));

        var existingOptions = new java.util.HashMap<String, QuestionOption>();
        for (var o : q.options) {
            if (o.kind == kind) {
                existingOptions.put(o.id, o);
            }
        }

        var orderedOptions = new ArrayList<QuestionOption>();
        var order = 0;
        for (var od : dtos) {
            QuestionOption o;
            if (od.id() != null && existingOptions.containsKey(od.id())) {
                o = existingOptions.get(od.id());
                o.label = od.label();
                o.order = order++;
                // Owner-set capacity is updatable; `used` is server-maintained.
                o.capacity = od.capacity();
            } else {
                o = new QuestionOption();
                o.id = od.id() != null ? od.id() : UUID.randomUUID().toString();
                o.question = q;
                o.kind = kind;
                o.label = od.label();
                o.order = order++;
                o.capacity = od.capacity();
            }
            orderedOptions.add(o);
        }

        q.options.removeIf(o -> o.kind == kind);
        q.options.addAll(orderedOptions);
    }

}
