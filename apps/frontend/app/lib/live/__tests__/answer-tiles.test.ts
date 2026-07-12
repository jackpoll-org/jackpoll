import { describe, it, expect } from "vitest";
import { ANSWER_TILES, answerTile } from "../answer-tiles";

describe("answer tiles", () => {
  it("has four distinct colour + shape slots", () => {
    expect(ANSWER_TILES).toHaveLength(4);
    expect(new Set(ANSWER_TILES.map((tile) => tile.name)).size).toBe(4);
    expect(new Set(ANSWER_TILES.map((tile) => tile.color)).size).toBe(4);
    for (const tile of ANSWER_TILES) expect(tile.Shape).toBeTruthy();
  });

  it("wraps the slot index into range", () => {
    expect(answerTile(0)).toBe(ANSWER_TILES[0]);
    expect(answerTile(3)).toBe(ANSWER_TILES[3]);
    expect(answerTile(4)).toBe(ANSWER_TILES[0]);
    expect(answerTile(5)).toBe(ANSWER_TILES[1]);
    expect(answerTile(-1)).toBe(ANSWER_TILES[3]);
  });
});
