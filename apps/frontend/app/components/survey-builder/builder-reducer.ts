import { arrayMove } from "@dnd-kit/sortable";
import type {
  Question,
  QuestionType,
  Section,
  Survey,
  SurveyI18n,
  SurveySettings,
} from "@/app/types/survey";
import { newId } from "@/app/components/question-types/helpers";
import { getQuestionTypeDefinition } from "@/app/components/question-types/registry";
import { PROTECTED_SETTINGS, type CollabContent } from "@/app/lib/collab/doc";
import { questionsInPageOrder, sectionKey } from "@/app/lib/survey/pagination";
import { widensExposure } from "@/app/lib/results/live-exposure";

export interface BuilderState {
  survey: Survey;
  /** True when there are unsaved edits (local or merged from a collaborator). */
  dirty: boolean;
  /**
   * True only when *this* client made an edit that isn't yet saved. Autosave
   * keys off this (not `dirty`) so a peer merely receiving a remote change does
   * not also race to persist it — preventing an N-client save echo storm (#85).
   */
  locallyDirty: boolean;
  sharingBaseline: Record<string, Sharing>;
  ownSharing: Record<string, Sharing>;
  quizBaseline: boolean;
  ownQuiz?: boolean;
}

const SHARING_SETTINGS = ["resultChart", "poll", "scoreOrder", "optionPoints"] as const;
const QUIZ_FIELDS = ["correctAnswers", "poll", "scoreOrder", "optionPoints"] as const;

type Sharing = Partial<Pick<Question, "type" | "options" | "showInLiveResults" | "correctAnswers">> &
  Partial<Record<(typeof SHARING_SETTINGS)[number], unknown>>;

type CoreState = Pick<BuilderState, "survey" | "dirty">;

export type BuilderAction =
  | { type: "reset"; survey: Survey }
  | { type: "saved"; survey: Survey }
  | {
      type: "updateMeta";
      patch: Partial<Pick<Survey, "title" | "description" | "status">>;
    }
  | { type: "updateSettings"; patch: Partial<SurveySettings> }
  | {
      type: "addQuestion";
      questionType: QuestionType;
      sectionId?: string | null;
      /** Overrides merged onto the type defaults (e.g. a True/False preset). */
      init?: Partial<Question>;
    }
  | { type: "updateQuestion"; id: string; patch: Partial<Question> }
  | { type: "removeQuestion"; id: string }
  | { type: "moveQuestion"; id: string; direction: "up" | "down" }
  | { type: "reorderQuestions"; activeId: string; overId: string }
  | { type: "addSection"; id?: string }
  | { type: "updateSection"; id: string; patch: Partial<Section> }
  | { type: "removeSection"; id: string }
  | { type: "reorderSections"; activeId: string; overId: string }
  | { type: "setQuestionSection"; questionId: string; sectionId: string | null }
  // Multilingual content (issue #37)
  | { type: "setLanguages"; languages: string[]; defaultLanguage: string }
  | { type: "setTranslation"; locale: string; key: string; value: string }
  // Live co-editing: merge a remote document snapshot (issue #85)
  | { type: "applyRemote"; content: CollabContent }
  | { type: "refreshSharingBaseline"; survey: Survey };

export const FIRST_PAGE_ID = "__first-page__";

/** Reassign sequential `order` values after structural changes. */
function reorder(questions: Question[]): Question[] {
  return questions.map((q, index) => ({ ...q, order: index }));
}

function reorderSections(sections: Section[]): Section[] {
  return sections.map((s, index) => ({ ...s, order: index }));
}

/**
 * Public reducer: runs the core transition, then layers on `locallyDirty`.
 * Only local edits set it true; `reset`/`saved` clear it, `applyRemote` keeps it
 * only while this client has unsaved result-sharing changes.
 */
export function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  if (action.type === "refreshSharingBaseline") {
    const withheld = withheldSharing(state);
    const server = action.survey.questions.filter((q) => withheld.includes(q.id));
    return {
      ...state,
      sharingBaseline: { ...state.sharingBaseline, ...sharingBaselineOf({ ...action.survey, questions: server }) },
      quizBaseline: withholdsQuiz(state) ? isQuiz(action.survey) : state.quizBaseline,
    };
  }
  const next = coreReducer(state, action);
  if (next === state) return state; // edge no-ops keep identity (and the flag)
  if (action.type === "reset") return initialBuilderState(action.survey);
  if (action.type === "saved") {
    return {
      ...initialBuilderState(keepWithheldSharing(state, action.survey)),
      sharingBaseline: sharingBaselineOf(action.survey),
      quizBaseline: isQuiz(action.survey),
    };
  }
  if (action.type === "applyRemote") {
    const ownChanges = Object.keys(state.ownSharing).length > 0 || state.ownQuiz !== undefined;
    return { ...state, ...next, locallyDirty: ownChanges };
  }
  const changed = next.survey.questions
    .filter((q) => exposure(q) !== exposure(findQuestion(state.survey, q.id)))
    .map((q) => [q.id, sharingOf(q)] as const);
  return {
    ...state,
    ...next,
    locallyDirty: true,
    ownSharing: { ...state.ownSharing, ...Object.fromEntries(changed) },
    ownQuiz: isQuiz(next.survey) !== isQuiz(state.survey) ? isQuiz(next.survey) : state.ownQuiz,
  };
}

export function initialBuilderState(survey: Survey): BuilderState {
  return {
    survey,
    dirty: false,
    locallyDirty: false,
    sharingBaseline: sharingBaselineOf(survey),
    ownSharing: {},
    quizBaseline: isQuiz(survey),
  };
}

const findQuestion = (survey: Survey, id: string) => survey.questions.find((q) => q.id === id);

const isQuiz = (survey: Survey) => survey.settings?.isQuiz === true;

const sharingOf = (q: Question): Sharing => ({
  type: q.type,
  options: q.options,
  showInLiveResults: q.showInLiveResults,
  correctAnswers: q.correctAnswers,
  ...Object.fromEntries(SHARING_SETTINGS.map((key) => [key, q.settings?.[key]])),
});

const exposure = (q: Question | undefined) => {
  if (!q) return undefined;
  const sharing = sharingOf(q);
  return JSON.stringify([
    q.showInLiveResults !== false,
    sharing.resultChart === "wordcloud",
    q.type,
    q.options?.map((o) => o.id),
    ...QUIZ_FIELDS.map((key) => sharing[key]),
  ]);
};

function sharingBaselineOf(survey: Survey): Record<string, Sharing> {
  return Object.fromEntries(survey.questions.map((q) => [q.id, sharingOf(q)]));
}

function withSharing(q: Question, sharing: Sharing): Question {
  const next = { ...q, showInLiveResults: sharing.showInLiveResults, correctAnswers: sharing.correctAnswers };
  const changed = SHARING_SETTINGS.filter((key) => q.settings?.[key] !== sharing[key]);
  if (changed.length === 0) return next;
  const settings: Record<string, unknown> = { ...q.settings };
  for (const key of changed) {
    if (sharing[key] === undefined) delete settings[key];
    else settings[key] = sharing[key];
  }
  return { ...next, settings };
}

function withoutWidening(q: Question, base: Sharing | undefined, quiz: boolean): Question {
  const known = base ?? {};
  const widensLive = known.showInLiveResults === false && q.showInLiveResults !== false;
  const widensCloud = q.settings?.resultChart === "wordcloud" && known.resultChart !== "wordcloud";
  const shared =
    widensLive || widensCloud
      ? withSharing(q, {
          ...sharingOf(q),
          showInLiveResults: widensLive ? known.showInLiveResults : q.showInLiveResults,
          resultChart: widensCloud ? known.resultChart : q.settings?.resultChart,
        })
      : q;
  if (!base) return shared;
  const before = { ...withSharing(shared, base), type: base.type ?? shared.type, options: base.options };
  if (!widensExposure(before, quiz, shared, quiz)) return shared;
  const restored = withSharing(shared, base);
  return widensExposure(before, quiz, restored, quiz) ? { ...restored, showInLiveResults: false } : restored;
}

export function surveyToSave(state: BuilderState): Survey {
  const quizBefore = state.ownQuiz ?? state.quizBaseline;
  const quiz = quizBefore || isQuiz(state.survey);
  const baseOf = (id: string) => state.ownSharing[id] ?? state.sharingBaseline[id];
  const questions = state.survey.questions.map((q) => withoutWidening(q, baseOf(q.id), quiz));
  const keepQuiz =
    quizBefore &&
    !isQuiz(state.survey) &&
    questions.some((q) => baseOf(q.id) && widensExposure(q, true, q, false));
  if (!keepQuiz && questions.every((q, i) => q === state.survey.questions[i])) return state.survey;
  return {
    ...state.survey,
    questions,
    ...(keepQuiz ? { settings: { ...state.survey.settings, isQuiz: true } } : {}),
  };
}

export function withheldSharing(state: BuilderState): string[] {
  const sent = surveyToSave(state);
  return sent.questions.filter((q, i) => q !== state.survey.questions[i]).map((q) => q.id);
}

function withholdsQuiz(state: BuilderState): boolean {
  return isQuiz(surveyToSave(state)) !== isQuiz(state.survey);
}

export async function resolveSaveable(
  getState: () => BuilderState,
  dispatch: (action: BuilderAction) => void,
  load: () => Promise<Survey>,
): Promise<Survey> {
  if (surveyToSave(getState()) === getState().survey) return getState().survey;
  const server = await load().catch(() => null);
  if (!server) return surveyToSave(getState());
  const action: BuilderAction = { type: "refreshSharingBaseline", survey: server };
  dispatch(action);
  return surveyToSave(builderReducer(getState(), action));
}

function keepWithheldSharing(state: BuilderState, saved: Survey): Survey {
  const withheld = new Set(withheldSharing(state));
  const quiz = withholdsQuiz(state);
  if (withheld.size === 0 && !quiz) return saved;
  const questions = saved.questions.map((q) => {
    const local = findQuestion(state.survey, q.id);
    return local && withheld.has(q.id) ? withSharing(q, sharingOf(local)) : q;
  });
  return {
    ...saved,
    questions,
    ...(quiz ? { settings: { ...saved.settings, isQuiz: isQuiz(state.survey) } } : {}),
  };
}

function mergeRemoteSettings(local: SurveySettings, remote: SurveySettings): SurveySettings {
  const merged = { ...remote };
  for (const key of PROTECTED_SETTINGS) {
    (merged as Record<string, unknown>)[key] = local[key];
  }
  return merged;
}

function coreReducer(state: CoreState, action: BuilderAction): CoreState {
  switch (action.type) {
    case "reset":
      return { survey: action.survey, dirty: false };

    case "saved":
      return { survey: action.survey, dirty: false };

    case "applyRemote":
      // A collaborator's change arrived — merge the shared content, keeping
      // local-only fields (id, ownerId, timestamps, i18n, folder, tags).
      return {
        survey: {
          ...state.survey,
          title: action.content.title,
          description: action.content.description,
          status: action.content.status,
          settings: mergeRemoteSettings(state.survey.settings, action.content.settings),
          questions: action.content.questions,
          sections: action.content.sections,
        },
        dirty: true,
      };

    case "updateMeta":
      return { survey: { ...state.survey, ...action.patch }, dirty: true };

    case "updateSettings":
      return {
        survey: {
          ...state.survey,
          settings: { ...state.survey.settings, ...action.patch },
        },
        dirty: true,
      };

    case "addQuestion": {
      const def = getQuestionTypeDefinition(action.questionType);
      const question: Question = {
        id: newId(),
        type: action.questionType,
        title: "",
        required: false,
        order: state.survey.questions.length,
        sectionId: action.sectionId ?? null,
        ...def.createDefaults(),
        ...(action.init ?? {}),
      };
      return {
        survey: {
          ...state.survey,
          questions: [...state.survey.questions, question],
        },
        dirty: true,
      };
    }

    case "updateQuestion": {
      const questions = state.survey.questions.map((q) =>
        q.id === action.id ? { ...q, ...action.patch } : q,
      );
      return { survey: { ...state.survey, questions }, dirty: true };
    }

    case "removeQuestion": {
      const questions = reorder(
        state.survey.questions.filter((q) => q.id !== action.id),
      );
      return { survey: { ...state.survey, questions }, dirty: true };
    }

    case "moveQuestion": {
      const index = state.survey.questions.findIndex((q) => q.id === action.id);
      if (index < 0) return state;
      const target = action.direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= state.survey.questions.length) return state;

      const questions = [...state.survey.questions];
      [questions[index], questions[target]] = [
        questions[target],
        questions[index],
      ];
      return {
        survey: { ...state.survey, questions: reorder(questions) },
        dirty: true,
      };
    }

    case "reorderQuestions": {
      if (action.activeId === action.overId) return state;
      const from = state.survey.questions.findIndex((q) => q.id === action.activeId);
      const to = state.survey.questions.findIndex((q) => q.id === action.overId);
      if (from < 0 || to < 0) return state;

      const questions = reorder(arrayMove(state.survey.questions, from, to));
      return { survey: { ...state.survey, questions }, dirty: true };
    }

    case "addSection": {
      const sections = state.survey.sections ?? [];
      const section: Section = {
        id: action.id ?? newId(),
        title: "",
        order: sections.length,
      };
      return {
        survey: { ...state.survey, sections: [...sections, section] },
        dirty: true,
      };
    }

    case "updateSection": {
      const sections = (state.survey.sections ?? []).map((s) =>
        s.id === action.id ? { ...s, ...action.patch } : s,
      );
      return { survey: { ...state.survey, sections }, dirty: true };
    }

    case "removeSection": {
      const sections = reorderSections(
        (state.survey.sections ?? []).filter((s) => s.id !== action.id),
      );
      // Unassign questions that belonged to the removed section.
      const questions = state.survey.questions.map((q) =>
        q.sectionId === action.id ? { ...q, sectionId: null } : q,
      );
      return { survey: { ...state.survey, sections, questions }, dirty: true };
    }

    case "reorderSections": {
      if (action.activeId === action.overId) return state;
      const base =
        action.activeId === FIRST_PAGE_ID || action.overId === FIRST_PAGE_ID
          ? convertFirstPage(state.survey, firstPageSectionId(state.survey))
          : { survey: state.survey, id: FIRST_PAGE_ID };
      const toId = (id: string) => (id === FIRST_PAGE_ID ? base.id : id);
      const sections = base.survey.sections ?? [];
      const from = sections.findIndex((s) => s.id === toId(action.activeId));
      const to = sections.findIndex((s) => s.id === toId(action.overId));
      if (from < 0 || to < 0) return state;
      const survey = { ...base.survey, sections: reorderSections(arrayMove(sections, from, to)) };
      const questions = reorder([...new Set(questionsInPageOrder(survey))]);
      return { survey: { ...survey, questions }, dirty: true };
    }

    case "setQuestionSection": {
      const questions = state.survey.questions.map((q) =>
        q.id === action.questionId ? { ...q, sectionId: action.sectionId } : q,
      );
      return { survey: { ...state.survey, questions }, dirty: true };
    }

    case "setLanguages": {
      // Drop translations for locales that are no longer enabled.
      const enabled = new Set(action.languages);
      const i18n = pruneI18n(state.survey.i18n, enabled, action.defaultLanguage);
      return {
        survey: {
          ...state.survey,
          languages: action.languages,
          defaultLanguage: action.defaultLanguage,
          i18n,
        },
        dirty: true,
      };
    }

    case "setTranslation": {
      const i18n = setTranslationValue(
        state.survey.i18n,
        action.locale,
        action.key,
        action.value,
      );
      return { survey: { ...state.survey, i18n }, dirty: true };
    }

    default:
      return state;
  }
}

export function firstPageSectionId(survey: Survey): string {
  const taken = new Set((survey.sections ?? []).map((s) => s.id));
  const base = `${survey.id}-page-1`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function convertFirstPage(survey: Survey, id: string): { survey: Survey; id: string } {
  const { firstPageTitle, firstPageDescription, ...settings } = survey.settings;
  const section: Section = { id, title: firstPageTitle, description: firstPageDescription, order: 0 };
  return {
    id,
    survey: {
      ...survey,
      settings,
      sections: [section, ...(survey.sections ?? [])],
      questions: survey.questions.map((q) => (sectionKey(q.sectionId) !== null ? q : { ...q, sectionId: id })),
    },
  };
}

/** Remove disabled locales and the default locale (canonical fields win). */
function pruneI18n(
  i18n: SurveyI18n | undefined,
  enabled: Set<string>,
  defaultLanguage: string,
): SurveyI18n | undefined {
  if (!i18n) return i18n;
  const next: SurveyI18n = {};
  for (const [locale, bag] of Object.entries(i18n)) {
    if (locale !== defaultLanguage && enabled.has(locale)) next[locale] = bag;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Immutably set (or clear, when blank) a single translation value. */
function setTranslationValue(
  i18n: SurveyI18n | undefined,
  locale: string,
  key: string,
  value: string,
): SurveyI18n | undefined {
  const base: SurveyI18n = { ...(i18n ?? {}) };
  const bag = { ...(base[locale] ?? {}) };
  if (value.trim()) {
    bag[key] = value;
  } else {
    delete bag[key];
  }
  if (Object.keys(bag).length > 0) {
    base[locale] = bag;
  } else {
    delete base[locale];
  }
  return Object.keys(base).length > 0 ? base : undefined;
}
