import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validCaptcha } from "@/app/lib/survey/captcha";

const inSeconds = (s: number) => Math.floor(Date.now() / 1000) + s;
const payloadExpiringAt = (expires: number) =>
  btoa(JSON.stringify({ salt: `abc?expires=${expires}&survey=s1`, number: 1 }));

afterEach(() => vi.unstubAllGlobals());

describe("captcha refresh", () => {
  it("reuses a solution that is still valid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const payload = payloadExpiringAt(inSeconds(600));
    await expect(validCaptcha("s1", payload)).resolves.toBe(payload);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("solves a fresh challenge once the solution has expired", async () => {
    const salt = `fresh?expires=${inSeconds(1200)}&survey=s1`;
    const challenge = createHash("sha256").update(salt + 42).digest("hex");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ algorithm: "SHA-256", challenge, maxnumber: 100, salt, signature: "sig" }),
        ),
      ),
    );
    const solved = JSON.parse(atob(await validCaptcha("s1", payloadExpiringAt(inSeconds(-1)))));
    expect(solved).toEqual({ algorithm: "SHA-256", challenge, number: 42, salt, signature: "sig" });
  });

  it("solves once and reuses the fresh solution for later submissions", async () => {
    const salt = `fresh?expires=${inSeconds(1200)}&survey=s2`;
    const challenge = createHash("sha256").update(salt + 7).digest("hex");
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ algorithm: "SHA-256", challenge, maxnumber: 100, salt, signature: "sig" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const otherSurvey = payloadExpiringAt(inSeconds(600));
    const first = await validCaptcha("s2", otherSurvey);
    await expect(validCaptcha("s2", otherSurvey)).resolves.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
