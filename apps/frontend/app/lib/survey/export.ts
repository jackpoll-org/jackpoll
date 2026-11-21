import { toast } from "sonner";
import type {
  Option,
  Question,
  QuestionResult,
  RespondentToken,
  Survey,
  SurveyResponseDto,
  UploadedFile,
} from "@/app/types/survey";
import { saveTextFile } from "@/app/lib/native/file-share";
import { isAnswerable } from "@/app/lib/survey/content-block";
import { questionsInPageOrder } from "@/app/lib/survey/pagination";

/** Build a label lookup (option/row/column id → label) for a question. */
export function labelMap(question: Question | undefined): Record<string, string> {
  const map: Record<string, string> = Object.create(null);
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

function csvCell(raw: string): string {
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV of all responses, one row per response, one column per question. */
export function buildResponsesCsv(
  survey: Survey,
  responses: SurveyResponseDto[],
  resultQuestions: Pick<QuestionResult, "questionId" | "title" | "type">[] = [],
): string {
  const current = questionsInPageOrder(survey).filter((q) => isAnswerable(q.type));
  const known = new Set(current.map((q) => q.id));
  const questions = [
    ...current,
    ...resultQuestions
      .filter((q) => !known.has(q.questionId))
      .map((q) => ({ id: q.questionId, title: q.title, type: q.type }) as Question),
  ];
  const withToken = responses.some((r) => r.respondentToken);
  const withScore = responses.some((r) => r.score != null);
  const withGrade = responses.some((r) => r.grade);
  const header = [
    "Response ID",
    "Submitted at",
    "Duration (s)",
    ...(withToken ? ["Token"] : []),
    ...(withScore ? ["Score", "Max score"] : []),
    ...(withGrade ? ["Grade"] : []),
    ...questions.map((q) => q.title || "Untitled question"),
  ];

  const rows = responses.map((response) => {
    const byQuestion = new Map(response.answers.map((a) => [a.questionId, a.value]));
    return [
      response.id,
      response.submittedAt,
      response.durationMs != null ? (response.durationMs / 1000).toFixed(1) : "",
      ...(withToken ? [response.respondentToken ?? ""] : []),
      ...(withScore ? [response.score ?? "", response.maxScore ?? ""] : []),
      ...(withGrade ? [response.grade ?? ""] : []),
      ...questions.map((q) => formatAnswer(q, byQuestion.get(q.id))),
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(String(cell))).join(","))
    .join("\n");
}

export function parseTokenList(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

export function buildTokensCsv(
  tokens: RespondentToken[],
  linkFor: (token: string) => string,
): string {
  return [
    ["token", "link", "used"],
    ...tokens.map((t) => [t.token, linkFor(t.token), t.usedAt ? "yes" : "no"]),
  ]
    .map((row) => row.map(csvCell).join(","))
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
