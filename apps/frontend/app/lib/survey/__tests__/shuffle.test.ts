import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question, Survey } from "@/app/types/survey";
import { seededShuffle, shuffleSeed, shuffleSurvey } from "../shuffle";

function q(id: string, sectionId: string | null = null, type: Question["type"] = "short-answer"): Question {
  return {
    id,
    type,
    title: id,
    required: false,
    order: 0,
    sectionId,
    options: ["a", "b", "c", "d", "e", "f"].map((o) => ({ id: `${id}-${o}`, label: o })),
  };
}

function survey(questions: Question[], settings: Partial<Survey["settings"]>): Survey {
  return { id: "s1", title: "S", status: "published", settings, questions } as unknown as Survey;
}

const ids = (s: Survey) => s.questions.map((x) => x.id);
const many = Array.from({ length: 12 }, (_, i) => `q${i}`);

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("seededShuffle", () => {
  it("returns the same permutation for the same seed and another for a different seed", () => {
    const first = seededShuffle(many, "seed-1");
    expect(seededShuffle(many, "seed-1")).toEqual(first);
    expect(first.toSorted()).toEqual(many.toSorted());
    expect(first).not.toEqual(many);
    expect(seededShuffle(many, "seed-2")).not.toEqual(first);
  });
});

describe("shuffleSurvey", () => {
  it("leaves the survey alone when shuffling is off or in live mode", () => {
    const s = survey(many.map((id) => q(id)), {});
    expect(shuffleSurvey(s, "x")).toBe(s);
    const live = survey(s.questions, { shuffleQuestions: true, shuffleOptions: true, liveMode: true });
    expect(shuffleSurvey(live, "x")).toBe(live);
  });

  it("shuffles questions only within their page and between content blocks", () => {
    const questions = [
      ...many.slice(0, 6).map((id) => q(id, "p1")),
      q("intro", "p2", "content"),
      ...many.slice(6).map((id) => q(id, "p2")),
      q("outro", "p2", "content"),
      q("last", "p2"),
    ];
    const s = survey(questions, { shuffleQuestions: true });
    const out = shuffleSurvey(s, "seed");
    expect(ids(out)).toEqual(ids(shuffleSurvey(s, "seed")));
    expect(ids(out)).not.toEqual(ids(s));
    expect(ids(out).slice(0, 6).toSorted()).toEqual(many.slice(0, 6).toSorted());
    expect(ids(out)[6]).toBe("intro");
    expect(ids(out).slice(7, 13).toSorted()).toEqual(many.slice(6).toSorted());
    expect(ids(out).slice(13)).toEqual(["outro", "last"]);
    expect(out.questions.every((x) => x.options?.map((o) => o.label).join("") === "abcdef")).toBe(true);
  });

  it("keeps sections together in conversational mode", () => {
    const questions = many.map((id, i) => q(id, i < 6 ? "p1" : "p2"));
    const out = ids(shuffleSurvey(survey(questions, { shuffleQuestions: true, conversational: true }), "seed"));
    expect(out.slice(0, 6).toSorted()).toEqual(many.slice(0, 6).toSorted());
    expect(out.slice(6).toSorted()).toEqual(many.slice(6).toSorted());
    expect(out).not.toEqual(many);
  });

  it("keeps questions used by logic or piping in place", () => {
    const questions = many.map((id) => q(id));
    questions[3] = { ...questions[3], settings: { logic: { match: "all", conditions: [{ questionId: "q1", operator: "notEmpty" }] } } };
    questions[8] = { ...questions[8], title: "You said {{q10}}" };
    for (const conversational of [false, true]) {
      const out = ids(shuffleSurvey(survey(questions, { shuffleQuestions: true, conversational }), "seed"));
      for (const fixed of [1, 3, 8, 10]) expect(out[fixed]).toBe(`q${fixed}`);
      expect(out).not.toEqual(many);
    }
  });

  it("shuffles the options of choice questions only", () => {
    const types: Question["type"][] = ["multiple-choice", "checkboxes", "dropdown", "ranking", "multiple-choice-grid"];
    const s = survey(types.map((type) => q(type, null, type)), { shuffleOptions: true });
    const out = shuffleSurvey(s, "seed");
    expect(ids(out)).toEqual(types);
    const labels = out.questions.map((x) => x.options!.map((o) => o.label).join(""));
    expect(labels.slice(0, 3).every((l) => l !== "abcdef" && l.split("").toSorted().join("") === "abcdef")).toBe(true);
    expect(labels.slice(3)).toEqual(["abcdef", "abcdef"]);
  });
});

describe("shuffleSeed", () => {
  it("keeps one seed per survey in localStorage", () => {
    const seed = shuffleSeed("s1");
    expect(shuffleSeed("s1")).toBe(seed);
    expect(shuffleSeed("s2")).not.toBe(seed);
  });

  it("falls back to a seed that is stable for the session without storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const seed = shuffleSeed("s3");
    expect(shuffleSeed("s3")).toBe(seed);
  });
});
