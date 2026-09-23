import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueSubmission,
  listQueued,
  queuedCount,
  removeQueued,
} from "@/app/lib/survey/offline-queue";
import type { SubmitResponseRequest } from "@/app/types/survey";

const payload = (answer: string): SubmitResponseRequest => ({
  answers: [{ questionId: "q1", value: answer }],
});

async function clear() {
  for (const item of await listQueued()) await removeQueued(item.id);
}

describe("offline submission outbox", () => {
  beforeEach(clear);
  afterEach(() => vi.restoreAllMocks());

  it("enqueues, lists oldest-first, and counts", async () => {
    const a = await enqueueSubmission("s1", payload("A"));
    const b = await enqueueSubmission("s2", payload("B"));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    expect(await queuedCount()).toBe(2);
    const items = await listQueued();
    expect(items.map((i) => i.surveyId)).toEqual(["s1", "s2"]);
    expect(items[0].payload.answers[0].value).toBe("A");
  });

  it("keeps enqueue order when submissions share a millisecond", async () => {
    // Freeze the clock so every entry gets the same wall-clock time; the
    // order must not fall back to the (random) UUID key order.
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const ids = ["s1", "s2", "s3", "s4", "s5", "s6"];
    for (const id of ids) await enqueueSubmission(id, payload(id));

    const items = await listQueued();
    expect(items.map((i) => i.surveyId)).toEqual(ids);
  });

  it("removes a flushed entry", async () => {
    const entry = await enqueueSubmission("s1", payload("X"));
    await removeQueued(entry!.id);
    expect(await queuedCount()).toBe(0);
    expect(await listQueued()).toEqual([]);
  });
});
