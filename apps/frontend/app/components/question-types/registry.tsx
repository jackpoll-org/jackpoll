import {
  AlignLeft,
  CircleDot,
  ListChecks,
  ChevronDownSquare,
  Grid3x3,
  LayoutGrid,
  UploadCloud,
  SlidersHorizontal,
  Star,
  CalendarClock,
  ListOrdered,
  Table2,
  PenLine,
  Cloud,
} from "lucide-react";
import type { QuestionType } from "@/app/types/survey";
import type { QuestionTypeDefinition } from "./types";
import { createOption } from "./helpers";
import { ShortAnswerEditor } from "./editors/short-answer-editor";
import { ChoiceEditor } from "./editors/choice-editor";
import { GridEditor } from "./editors/grid-editor";
import { FileUploadEditor } from "./editors/file-upload-editor";
import { SliderEditor } from "./editors/slider-editor";
import { RatingEditor } from "./editors/rating-editor";
import { DateEditor } from "./editors/date-editor";
import { RatingGridEditor } from "./editors/rating-grid-editor";
import { SignatureEditor } from "./editors/signature-editor";
import { WordcloudEditor } from "./editors/wordcloud-editor";
import { ShortAnswerPreview } from "./previews/short-answer-preview";
import { ChoicePreview } from "./previews/choice-preview";
import { GridPreview } from "./previews/grid-preview";
import { FileUploadPreview } from "./previews/file-upload-preview";
import { SliderPreview } from "./previews/slider-preview";
import { RatingPreview } from "./previews/rating-preview";
import { DatePreview } from "./previews/date-preview";
import { RankingPreview } from "./previews/ranking-preview";
import { RatingGridPreview } from "./previews/rating-grid-preview";
import { SignaturePreview } from "./previews/signature-preview";
import { WordcloudPreview } from "./previews/wordcloud-preview";

/**
 * Registry of all question types available in milestone 1. Builder and player
 * render generically through this map, so adding a new type is a single entry.
 */
export const QUESTION_TYPES: Record<QuestionType, QuestionTypeDefinition> = {
  "short-answer": {
    type: "short-answer",
    label: "Short answer",
    labelKey: "qtype.short-answer",
    icon: AlignLeft,
    createDefaults: () => ({}),
    Editor: ShortAnswerEditor,
    Preview: ShortAnswerPreview,
  },
  "multiple-choice": {
    type: "multiple-choice",
    label: "Multiple choice",
    labelKey: "qtype.multiple-choice",
    icon: CircleDot,
    createDefaults: () => ({ options: [createOption("Option 1")] }),
    Editor: ChoiceEditor,
    Preview: ChoicePreview,
  },
  checkboxes: {
    type: "checkboxes",
    label: "Checkboxes",
    labelKey: "qtype.checkboxes",
    icon: ListChecks,
    createDefaults: () => ({ options: [createOption("Option 1")] }),
    Editor: ChoiceEditor,
    Preview: ChoicePreview,
  },
  dropdown: {
    type: "dropdown",
    label: "Dropdown",
    labelKey: "qtype.dropdown",
    icon: ChevronDownSquare,
    createDefaults: () => ({ options: [createOption("Option 1")] }),
    Editor: ChoiceEditor,
    Preview: ChoicePreview,
  },
  "multiple-choice-grid": {
    type: "multiple-choice-grid",
    label: "Multiple choice grid",
    labelKey: "qtype.multiple-choice-grid",
    icon: Grid3x3,
    createDefaults: () => ({
      rows: [createOption("Row 1")],
      columns: [createOption("Column 1")],
    }),
    Editor: GridEditor,
    Preview: GridPreview,
  },
  "checkbox-grid": {
    type: "checkbox-grid",
    label: "Checkbox grid",
    labelKey: "qtype.checkbox-grid",
    icon: LayoutGrid,
    createDefaults: () => ({
      rows: [createOption("Row 1")],
      columns: [createOption("Column 1")],
    }),
    Editor: GridEditor,
    Preview: GridPreview,
  },
  "file-upload": {
    type: "file-upload",
    label: "File upload",
    labelKey: "qtype.file-upload",
    icon: UploadCloud,
    createDefaults: () => ({ settings: { multiple: false, maxSizeMb: 10 } }),
    Editor: FileUploadEditor,
    Preview: FileUploadPreview,
  },
  slider: {
    type: "slider",
    label: "Slider",
    labelKey: "qtype.slider",
    icon: SlidersHorizontal,
    createDefaults: () => ({ settings: { min: 0, max: 10, step: 1 } }),
    Editor: SliderEditor,
    Preview: SliderPreview,
  },
  rating: {
    type: "rating",
    label: "Rating",
    labelKey: "qtype.rating",
    icon: Star,
    createDefaults: () => ({ settings: { variant: "stars", max: 5 } }),
    Editor: RatingEditor,
    Preview: RatingPreview,
  },
  date: {
    type: "date",
    label: "Date & time",
    labelKey: "qtype.date",
    icon: CalendarClock,
    createDefaults: () => ({ settings: { mode: "date" } }),
    Editor: DateEditor,
    Preview: DatePreview,
  },
  ranking: {
    type: "ranking",
    label: "Ranking",
    labelKey: "qtype.ranking",
    icon: ListOrdered,
    createDefaults: () => ({
      options: [
        createOption("Option 1"),
        createOption("Option 2"),
        createOption("Option 3"),
      ],
    }),
    Editor: ChoiceEditor,
    Preview: RankingPreview,
  },
  "rating-grid": {
    type: "rating-grid",
    label: "Rating grid",
    labelKey: "qtype.rating-grid",
    icon: Table2,
    createDefaults: () => ({
      rows: [createOption("Row 1"), createOption("Row 2")],
      settings: { scaleMax: 5 },
    }),
    Editor: RatingGridEditor,
    Preview: RatingGridPreview,
  },
  signature: {
    type: "signature",
    label: "Signature",
    labelKey: "qtype.signature",
    icon: PenLine,
    createDefaults: () => ({}),
    Editor: SignatureEditor,
    Preview: SignaturePreview,
  },
  wordcloud: {
    type: "wordcloud",
    label: "Word cloud",
    labelKey: "qtype.wordcloud",
    icon: Cloud,
    createDefaults: () => ({ settings: { maxWords: 3, filterProfanity: true } }),
    Editor: WordcloudEditor,
    Preview: WordcloudPreview,
  },
};

/** Question types offered in the builder's "add question" menu. */
export const BUILDER_QUESTION_TYPES: QuestionType[] = [
  "short-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "multiple-choice-grid",
  "checkbox-grid",
  "file-upload",
  "slider",
  "rating",
  "date",
  "ranking",
  "rating-grid",
  "signature",
  "wordcloud",
];

export function getQuestionTypeDefinition(
  type: QuestionType,
): QuestionTypeDefinition {
  return QUESTION_TYPES[type];
}
