// ── Yjs survey document binding (issue #85, stage 2) ────────────────
//
// Maps the editable part of a survey to Yjs shared types so concurrent edits
// merge: each question/section is its own Y.Map inside a Y.Array (keyed by id),
// and ordering is a plain `order` field (no physical array reordering, so moves
// are conflict-free). Scalar fields are Y.Map entries (field-level LWW); complex
// fields (options/settings/...) are stored as opaque JSON values.

import * as Y from "yjs";
import type {
  Option,
  Question,
  Section,
  Survey,
  SurveySettings,
} from "@/app/types/survey";

/** The collaboratively-edited subset of a survey (the rest is stable metadata). */
export interface CollabContent {
  title: string;
  description?: string;
  status: Survey["status"];
  settings: SurveySettings;
  questions: Question[];
  sections: Section[];
}

const ROOT = "survey";

// Question fields: free-text fields are Y.Text (character-level merge + stable
// caret positions, #85), the rest are scalars or opaque JSON values.
const Q_TEXT = ["title", "description"] as const;
const Q_SCALARS = [
  "type",
  "required",
  "order",
  "points",
  "showInLiveResults",
  "sectionId",
] as const;
const Q_JSON = ["options", "rows", "columns", "settings", "correctAnswers"] as const;

function getRoot(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(ROOT);
}

/** Lazily get (or create) a Y.Text field on a Y.Map. */
function ensureText(map: Y.Map<unknown>, key: string): Y.Text {
  const cur = map.get(key);
  if (cur instanceof Y.Text) return cur;
  const text = new Y.Text();
  // Migrate a legacy plain-string value into the new Y.Text.
  if (typeof cur === "string" && cur) text.insert(0, cur);
  map.set(key, text);
  return text;
}

/** Read a Y.Text (or legacy string) field as a plain string. */
function readText(map: Y.Map<unknown>, key: string): string {
  const cur = map.get(key);
  if (cur instanceof Y.Text) return cur.toString();
  return typeof cur === "string" ? cur : "";
}

/**
 * Apply the minimal edit to turn `ytext` into `next` (common prefix/suffix
 * diff), so concurrent edits merge and peers' relative caret positions survive.
 * Never delete-all-then-insert.
 */
function setText(ytext: Y.Text, next: string): void {
  const cur = ytext.toString();
  if (cur === next) return;
  let start = 0;
  const min = Math.min(cur.length, next.length);
  while (start < min && cur[start] === next[start]) start++;
  let endCur = cur.length;
  let endNext = next.length;
  while (endCur > start && endNext > start && cur[endCur - 1] === next[endNext - 1]) {
    endCur--;
    endNext--;
  }
  const delCount = endCur - start;
  const insStr = next.slice(start, endNext);
  // No inner transact: callers wrap in doc.transact, and a not-yet-integrated
  // Y.Text (new question/section being built) has a null `doc`, which would
  // silently swallow the ops — losing the seeded text.
  if (delCount > 0) ytext.delete(start, delCount);
  if (insStr) ytext.insert(start, insStr);
}

/**
 * Resolve the Y.Text backing a specific text field, for caret math (#85).
 * Returns null if the question/section no longer exists.
 */
export function getFieldText(
  doc: Y.Doc,
  target: { questionId?: string; sectionId?: string; field: "title" | "description" },
): Y.Text | null {
  const root = getRoot(doc);
  if (target.questionId) {
    const arr = root.get("questions");
    if (!(arr instanceof Y.Array)) return null;
    const idx = indexById(arr as Y.Array<Y.Map<unknown>>, target.questionId);
    return idx < 0 ? null : ensureText((arr as Y.Array<Y.Map<unknown>>).get(idx), target.field);
  }
  if (target.sectionId) {
    const arr = root.get("sections");
    if (!(arr instanceof Y.Array)) return null;
    const idx = indexById(arr as Y.Array<Y.Map<unknown>>, target.sectionId);
    return idx < 0 ? null : ensureText((arr as Y.Array<Y.Map<unknown>>).get(idx), target.field);
  }
  return ensureText(root, target.field);
}

function ensureArray(root: Y.Map<unknown>, key: string): Y.Array<Y.Map<unknown>> {
  let arr = root.get(key);
  if (!(arr instanceof Y.Array)) {
    arr = new Y.Array();
    root.set(key, arr);
  }
  return arr as Y.Array<Y.Map<unknown>>;
}

function indexById(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr.get(i).get("id") === id) return i;
  }
  return -1;
}

/**
 * Set a key only when the value actually changed — so applying a full survey
 * snapshot emits ops *only* for what the local user touched, never clobbering a
 * concurrent edit to an untouched field.
 */
function setIfChanged(m: Y.Map<unknown>, key: string, value: unknown): void {
  const cur = m.get(key);
  const same =
    cur === value ||
    (cur != null && value != null && JSON.stringify(cur) === JSON.stringify(value));
  if (!same) m.set(key, value);
}

function writeQuestion(m: Y.Map<unknown>, q: Question): void {
  if (m.get("id") !== q.id) m.set("id", q.id);
  const rec = q as unknown as Record<string, unknown>;
  for (const k of Q_TEXT) setText(ensureText(m, k), (rec[k] as string) ?? "");
  for (const k of Q_SCALARS) setIfChanged(m, k, rec[k] ?? null);
  for (const k of Q_JSON) setIfChanged(m, k, rec[k] ?? null);
}

function readQuestion(m: Y.Map<unknown>): Question {
  const out: Record<string, unknown> = { id: m.get("id") };
  out.title = readText(m, "title");
  out.description = readText(m, "description") || null;
  for (const k of Q_SCALARS) out[k] = m.get(k) ?? null;
  for (const k of Q_JSON) out[k] = (m.get(k) as unknown) ?? null;
  return out as unknown as Question;
}

function writeSection(m: Y.Map<unknown>, s: Section): void {
  if (m.get("id") !== s.id) m.set("id", s.id);
  setText(ensureText(m, "title"), s.title ?? "");
  setText(ensureText(m, "description"), s.description ?? "");
  setIfChanged(m, "order", s.order);
  setIfChanged(m, "visibleIf", s.visibleIf ?? null);
}

function readSection(m: Y.Map<unknown>): Section {
  return {
    id: m.get("id") as string,
    title: readText(m, "title") || undefined,
    description: readText(m, "description") || undefined,
    order: (m.get("order") as number) ?? 0,
    visibleIf: (m.get("visibleIf") as Section["visibleIf"]) ?? undefined,
  };
}

/** Reconcile the Y.Doc to represent `content` (granular, id-keyed). */
export function applyContentToDoc(doc: Y.Doc, content: CollabContent): void {
  doc.transact(() => {
    const root = getRoot(doc);
    // Explicit seed marker (not "title"): a CollabTextInput may lazily create an
    // empty title Y.Text before sync settles, which must NOT count as seeded.
    setIfChanged(root, "seeded", true);
    setText(ensureText(root, "title"), content.title ?? "");
    setText(ensureText(root, "description"), content.description ?? "");
    setIfChanged(root, "status", content.status);
    // Settings rarely see concurrent edits — stored as one opaque value.
    setIfChanged(root, "settings", content.settings);

    reconcile(ensureArray(root, "questions"), content.questions, writeQuestion);
    reconcile(ensureArray(root, "sections"), content.sections, writeSection);
  });
}

function reconcile<T extends { id: string }>(
  arr: Y.Array<Y.Map<unknown>>,
  items: T[],
  write: (m: Y.Map<unknown>, item: T) => void,
): void {
  const wanted = new Set(items.map((i) => i.id));
  // Remove deleted (back to front).
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!wanted.has(arr.get(i).get("id") as string)) arr.delete(i, 1);
  }
  // Update existing / append new. Physical order doesn't matter (sorted by
  // the `order` field on read), so moves never touch the array.
  for (const item of items) {
    const idx = indexById(arr, item.id);
    if (idx === -1) {
      const m = new Y.Map();
      write(m, item);
      arr.push([m]);
    } else {
      write(arr.get(idx), item);
    }
  }
}

/** Read the collaborative content back out of the Y.Doc. */
export function docToContent(doc: Y.Doc): CollabContent {
  const root = getRoot(doc);
  const qArr = (root.get("questions") as Y.Array<Y.Map<unknown>>) ?? new Y.Array();
  const sArr = (root.get("sections") as Y.Array<Y.Map<unknown>>) ?? new Y.Array();

  const questions = dedupeById(
    (() => {
      const list: Question[] = [];
      qArr.forEach((m) => list.push(readQuestion(m)));
      return list;
    })(),
  ).toSorted((a, b) => a.order - b.order);

  const sections = dedupeById(
    (() => {
      const list: Section[] = [];
      sArr.forEach((m) => list.push(readSection(m)));
      return list;
    })(),
  ).toSorted((a, b) => a.order - b.order);

  return {
    title: readText(root, "title"),
    description: readText(root, "description") || undefined,
    status: (root.get("status") as Survey["status"]) ?? "draft",
    settings: (root.get("settings") as SurveySettings) ?? ({} as SurveySettings),
    questions,
    sections,
  };
}

/** Keep the first item per id — guards against a rare double-seed race. */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Whether the doc has been seeded (has content) — used to pick the seeder. */
export function docHasContent(doc: Y.Doc): boolean {
  return getRoot(doc).get("seeded") === true;
}

/** Narrow a full survey to its collaborative content. */
export function toCollabContent(survey: Survey): CollabContent {
  return {
    title: survey.title,
    description: survey.description,
    status: survey.status,
    settings: survey.settings,
    questions: (survey.questions ?? []) as Question[],
    sections: (survey.sections ?? []) as Section[],
  };
}

// Re-exported so callers don't import yjs directly for the Option type guard.
export type { Option };
