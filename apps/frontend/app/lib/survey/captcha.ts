import { altchaChallengeUrl } from "@/app/lib/survey/api";
import { localizeServerError } from "@/app/i18n/server-errors";

interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

const refreshed = new Map<string, string>();

function usable(surveyId: string, payload: string | undefined): payload is string {
  try {
    const salt = (JSON.parse(atob(payload ?? "")) as { salt: string }).salt;
    const params = new URLSearchParams(salt.split("?")[1]);
    return params.get("survey") === surveyId && Number(params.get("expires")) * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function solveCaptcha(surveyId: string): Promise<string> {
  const res = await fetch(altchaChallengeUrl(surveyId));
  if (!res.ok) throw new Error(`Captcha challenge failed (${res.status})`);
  const c = (await res.json()) as AltchaChallenge;
  const encoder = new TextEncoder();
  for (let number = 0; number <= c.maxnumber; number++) {
    const hash = await crypto.subtle.digest(c.algorithm, encoder.encode(c.salt + number));
    if (hex(hash) === c.challenge) {
      const { algorithm, challenge, salt, signature } = c;
      return btoa(JSON.stringify({ algorithm, challenge, number, salt, signature }));
    }
  }
  throw new Error(localizeServerError("Captcha challenge could not be solved"));
}

/** Solutions expire after 20 minutes; reuse one while it has a minute left, otherwise solve a fresh one. */
export async function validCaptcha(surveyId: string, payload: string): Promise<string> {
  if (usable(surveyId, payload)) return payload;
  const latest = refreshed.get(surveyId);
  if (usable(surveyId, latest)) return latest;
  const fresh = await solveCaptcha(surveyId);
  refreshed.set(surveyId, fresh);
  return fresh;
}
