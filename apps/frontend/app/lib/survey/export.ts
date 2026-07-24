import { toast } from "sonner";
import type {
  Option,
  Question,
  Survey,
  SurveyResponseDto,
  UploadedFile,
} from "@/app/types/survey";
import { saveTextFile } from "@/app/lib/native/file-share";

/** Build a label lookup (option/row/column id → label) for a question. */
export function labelMap(question: Question | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (list: Option[] | null | undefined) => {
    for (const o of list ?? []) map[o.id] = o.label;
  };
  add(question?.options);
  add(question?.rows);
  add(question?.columns);
  return map;
}

/** Human-readable rendering of a single answer value for export/detail views. */
export function formatAnswer(question: Question, value: unknown): string {
  if (value == null) return "";
  const labels = labelMap(question);
  const label = (id: string) => labels[id] ?? id;

  if (typeof value === "string") {
    // could be an option id (choice) or free text
    return labels[value] ?? value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    if (typeof value[0] === "string") {
      return (value as string[]).map(label).join("; ");
    }
    // uploaded files
    return (value as UploadedFile[]).map((f) => f.filename ?? f.url).join("; ");
  }
  if (typeof value === "object") {
    // grid: { rowId: colId | colId[] }
    return Object.entries(value as Record<string, string | string[]>)
      .map(([rowId, cols]) => {
        const cells = Array.isArray(cols) ? cols.map(label).join("/") : label(cols);
        return `${label(rowId)}: ${cells}`;
      })
      .join(" | ");
  }
  return String(value);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV of all responses, one row per response, one column per question. */
export function buildResponsesCsv(
  survey: Survey,
  responses: SurveyResponseDto[],
): string {
  const header = [
    "Response ID",
    "Submitted at",
    "Duration (s)",
    ...survey.questions.map((q) => q.title || "Untitled question"),
  ];

  const rows = responses.map((response) => {
    const byQuestion = new Map(response.answers.map((a) => [a.questionId, a.value]));
    return [
      response.id,
      response.submittedAt,
      response.durationMs != null ? (response.durationMs / 1000).toFixed(1) : "",
      ...survey.questions.map((q) => formatAnswer(q, byQuestion.get(q.id))),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(String(cell))).join(","))
    .join("\n");
}

/** Trigger a text-content download — browser download on web, native share
 *  sheet inside the iOS/Android app (`<a download>` is a no-op there). */
export function downloadText(
  filename: string,
  content: string,
  mime: string,
): void {
  saveTextFile(filename, content, mime).catch(() => {
    const de = typeof document !== "undefined" && document.documentElement.lang === "de";
    toast.error(de ? "Datei konnte nicht gespeichert werden" : "Failed to save file");
  });
}
