import type { Question, Survey } from "@/app/types/survey";
import { isAnswerable } from "./content-block";
import { getLogicRule } from "./logic";
import { sectionKey } from "./pagination";
import { TOKEN } from "./piping";

const PREFIX = "survey-shuffle-seed:";
const SHUFFLED_OPTION_TYPES = new Set<string>(["multiple-choice", "checkboxes", "dropdown"]);
const memorySeeds = new Map<string, string>();

export function shuffleSeed(surveyId: string): string {
  const key = `${PREFIX}${surveyId}`;
  try {
    let seed = window.localStorage.getItem(key);
    if (!seed) {
      seed = crypto.randomUUID();
      window.localStorage.setItem(key, seed);
    }
    return seed;
  } catch {
    let seed = memorySeeds.get(key);
    if (!seed) {
      seed = crypto.randomUUID();
      memorySeeds.set(key, seed);
    }
    return seed;
  }
}

function random(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const next = random(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function anchoredIds(survey: Survey): Set<string> {
  const ids = new Set<string>();
  const piped = (text?: string | null) => [...(text ?? "").matchAll(TOKEN)].map((m) => m[1]);
  for (const q of survey.questions) {
    const refs = [
      ...(getLogicRule(q)?.conditions.map((c) => c.questionId) ?? []),
      ...piped(q.title),
      ...piped(q.description),
    ];
    if (refs.length > 0) [q.id, ...refs].forEach((id) => ids.add(id));
  }
  for (const s of survey.sections ?? []) s.visibleIf?.conditions.forEach((c) => ids.add(c.questionId));
  return ids;
}

function shuffleQuestionOrder(survey: Survey, seed: string): Question[] {
  const { questions } = survey;
  const anchored = anchoredIds(survey);
  const groups = new Map<string, number[]>();
  const blocks = new Map<string | null, number>();
  questions.forEach((q, i) => {
    const section = sectionKey(q.sectionId);
    if (!isAnswerable(q.type) || anchored.has(q.id)) {
      blocks.set(section, (blocks.get(section) ?? 0) + 1);
      return;
    }
    const group = `${section ?? ""}#${blocks.get(section) ?? 0}`;
    groups.set(group, [...(groups.get(group) ?? []), i]);
  });
  const out = [...questions];
  for (const [group, slots] of groups) {
    seededShuffle(slots, `${seed}:${group}`).forEach((from, k) => {
      out[slots[k]] = questions[from];
    });
  }
  return out;
}

function shuffleOptions(question: Question, seed: string): Question {
  if (!SHUFFLED_OPTION_TYPES.has(question.type) || !question.options?.length) return question;
  return { ...question, options: seededShuffle(question.options, `${seed}:${question.id}`) };
}

export function shuffleSurvey(survey: Survey, seedOverride?: string): Survey {
  const { shuffleQuestions, shuffleOptions: options, liveMode } = survey.settings;
  if (liveMode || (!shuffleQuestions && !options)) return survey;
  const seed = seedOverride ?? shuffleSeed(survey.id);
  const ordered = shuffleQuestions ? shuffleQuestionOrder(survey, seed) : survey.questions;
  return {
    ...survey,
    questions: options ? ordered.map((q) => shuffleOptions(q, seed)) : ordered,
  };
}
