import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { Question, QuestionType } from "@/app/types/survey";
import type { AnswerValue } from "@/app/lib/survey/validation";
import type { TranslationKey } from "@/app/i18n/translations";

/** Props for a question-type editor (builder side). */
export interface QuestionEditorProps {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}

/**
 * Props for a question-type preview / answer renderer.
 * Read-only by default; pass `onChange` to render an interactive input
 * (used by the survey player).
 */
export interface QuestionPreviewProps {
  question: Question;
  value?: AnswerValue;
  onChange?: (value: AnswerValue) => void;
  disabled?: boolean;
  /** Option ids to disable individually — e.g. choices whose quota is full (#38). */
  disabledOptionIds?: string[];
  /**
   * When provided, the question submits each value as its own live response
   * instead of being batched into the survey submit (wordcloud presentation
   * mode). Resolves on success, rejects on failure. Only set on public surfaces.
   */
  onInstantSubmit?: (value: AnswerValue) => Promise<void>;
}

/** A single entry in the question-type registry. */
export interface QuestionTypeDefinition {
  type: QuestionType;
  /** English fallback label (used in tests / non-React contexts). */
  label: string;
  /** Translation key for the type's display name (issue #93). */
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Type-specific defaults applied when a question of this type is created. */
  createDefaults: () => Partial<Question>;
  Editor: ComponentType<QuestionEditorProps>;
  Preview: ComponentType<QuestionPreviewProps>;
}
