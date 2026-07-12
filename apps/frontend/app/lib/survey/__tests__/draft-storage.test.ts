import { describe, it, expect, beforeEach } from "vitest";
import {
  answersToInputs,
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
} from "../draft-storage";

describe("local draft storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips saved answers", () => {
    saveLocalDraft("s1", { q1: "hello", q2: ["a", "b"] }, 3);
    const draft = loadLocalDraft("s1");
    expect(draft?.answers).toEqual({ q1: "hello", q2: ["a", "b"] });
    expect(draft?.position).toBe(3);
    expect(typeof draft?.savedAt).toBe("number");
  });

  it("returns null when no draft exists", () => {
    expect(loadLocalDraft("missing")).toBeNull();
  });

  it("scopes drafts per survey", () => {
    saveLocalDraft("s1", { q1: "one" });
    saveLocalDraft("s2", { q1: "two" });
    expect(loadLocalDraft("s1")?.answers).toEqual({ q1: "one" });
    expect(loadLocalDraft("s2")?.answers).toEqual({ q1: "two" });
  });

  it("clears a draft", () => {
    saveLocalDraft("s1", { q1: "x" });
    clearLocalDraft("s1");
    expect(loadLocalDraft("s1")).toBeNull();
  });

  it("returns null for corrupted JSON", () => {
    window.localStorage.setItem("survey-draft:bad", "{not json");
    expect(loadLocalDraft("bad")).toBeNull();
  });

  it("converts an answer map to API inputs", () => {
    expect(answersToInputs({ q1: "a", q2: 5 })).toEqual([
      { questionId: "q1", value: "a" },
      { questionId: "q2", value: 5 },
    ]);
  });
});
