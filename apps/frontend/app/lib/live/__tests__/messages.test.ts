import { describe, it, expect } from "vitest";
import { normalizeLivePhase, parseJoinMessage, parseLiveMessage } from "../messages";

describe("parseLiveMessage", () => {
  it("round-trips the countdown phase", () => {
    expect(parseLiveMessage('{"live":{"index":2,"phase":"countdown"}}')).toEqual({
      index: 2,
      phase: "countdown",
    });
  });

  it("round-trips lobby/reveal/results phases", () => {
    expect(parseLiveMessage('{"live":{"index":0,"phase":"lobby"}}')?.phase).toBe("lobby");
    expect(parseLiveMessage('{"live":{"index":1,"phase":"reveal"}}')?.phase).toBe("reveal");
    expect(parseLiveMessage('{"live":{"index":3,"phase":"results"}}')?.phase).toBe("results");
  });

  it("falls back to 'question' for an unrecognized phase string", () => {
    expect(parseLiveMessage('{"live":{"index":0,"phase":"something-new"}}')?.phase).toBe(
      "question",
    );
  });

  it("returns null for non-live JSON and non-JSON frames", () => {
    expect(parseLiveMessage('{"join":{"name":"Ada"}}')).toBeNull();
    expect(parseLiveMessage("not json")).toBeNull();
    expect(parseLiveMessage("")).toBeNull();
  });
});

describe("normalizeLivePhase", () => {
  it("passes through known phases", () => {
    expect(normalizeLivePhase("lobby")).toBe("lobby");
    expect(normalizeLivePhase("countdown")).toBe("countdown");
    expect(normalizeLivePhase("reveal")).toBe("reveal");
    expect(normalizeLivePhase("results")).toBe("results");
  });

  it("falls back to 'question' for anything else", () => {
    expect(normalizeLivePhase("question")).toBe("question");
    expect(normalizeLivePhase("bogus")).toBe("question");
    expect(normalizeLivePhase(undefined)).toBe("question");
    expect(normalizeLivePhase(null)).toBe("question");
  });
});

describe("parseJoinMessage", () => {
  it("extracts a trimmed name", () => {
    expect(parseJoinMessage('{"join":{"name":" Ada "}}')).toBe("Ada");
  });

  it("returns null when there's no name", () => {
    expect(parseJoinMessage('{"live":{"index":0,"phase":"lobby"}}')).toBeNull();
    expect(parseJoinMessage('{"join":{"name":""}}')).toBeNull();
  });
});
