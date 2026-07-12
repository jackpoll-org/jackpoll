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
import type { CollabContent } from "@/app/lib/collab/doc";

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
}

/** Internal state shape before the locally-dirty flag is layered on. */
type CoreState = Omit<BuilderState, "locallyDirty">;

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
  | { type: "moveSection"; id: string; direction: "up" | "down" }
  | { type: "setQuestionSection"; questionId: string; sectionId: string | null }
  // Multilingual content (issue #37)
  | { type: "setLanguages"; languages: string[]; defaultLanguage: string }
  | { type: "setTranslation"; locale: string; key: string; value: string }
  // Live co-editing: merge a remote document snapshot (issue #85)
  | { type: "applyRemote"; content: CollabContent };

/** Reassign sequential `order` values after structural changes. */
function reorder(questions: Question[]): Question[] {
  return questions.map((q, index) => ({ ...q, order: index }));
}

function reorderSections(sections: Section[]): Section[] {
  return sections.map((s, index) => ({ ...s, order: index }));
}

/**
 * Public reducer: runs the core transition, then layers on `locallyDirty`.
 * Only local edits set it true; `reset`/`saved`/`applyRemote` clear it.
 */
export function builderReducer(
  state: BuilderState,
  action: BuilderAction,
): BuilderState {
  const next = coreReducer(state, action);
  if (next === state) return state; // edge no-ops keep identity (and the flag)
  const locallyDirty =
    action.type !== "reset" &&
    action.type !== "saved" &&
    action.type !== "applyRemote";
  return { ...next, locallyDirty };
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
          settings: action.content.settings,
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

    case "moveSection": {
      const sections = state.survey.sections ?? [];
      const index = sections.findIndex((s) => s.id === action.id);
      if (index < 0) return state;
      const target = action.direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= sections.length) return state;
      const next = reorderSections(arrayMove(sections, index, target));
      return { survey: { ...state.survey, sections: next }, dirty: true };
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
