import { describe, it, expect } from "vitest";
import { wordcloudConfig } from "../editors/wordcloud-editor";

describe("wordcloudConfig", () => {
  it("defaults to 3 words with no settings", () => {
    expect(wordcloudConfig(null).maxWords).toBe(3);
    expect(wordcloudConfig(undefined).maxWords).toBe(3);
    expect(wordcloudConfig({}).maxWords).toBe(3);
  });

  it("reads a valid maxWords", () => {
    expect(wordcloudConfig({ maxWords: 5 }).maxWords).toBe(5);
  });

  it("falls back to 3 for non-positive or non-numeric values", () => {
    expect(wordcloudConfig({ maxWords: 0 }).maxWords).toBe(3);
    expect(wordcloudConfig({ maxWords: -2 }).maxWords).toBe(3);
    expect(wordcloudConfig({ maxWords: "x" }).maxWords).toBe(3);
  });

  it("caps maxWords at 10 so one respondent can't flood the cloud", () => {
    expect(wordcloudConfig({ maxWords: 50 }).maxWords).toBe(10);
  });
});
