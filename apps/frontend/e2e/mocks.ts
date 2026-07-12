import type { Page } from "@playwright/test";

/**
 * A small published, multi-page survey used by the player journeys. Section
 * one holds a required short-answer (exercises validation #4); section two a
 * multiple-choice (exercises multi-page #28).
 */
export const MOCK_SURVEY = {
  id: "survey-e2e",
  ownerId: "owner-1",
  title: "Customer Feedback",
  description: "Tell us what you think.",
  status: "published",
  settings: {
    allowMultipleResponses: true,
    confirmationMessage: "Thanks — your response was recorded!",
    showProgressBar: true,
    shuffleQuestions: false,
    isQuiz: false,
    showLiveResults: false,
    postSubmitSummary: false,
    showPoweredBy: false,
    rateLimit: false,
    onePerBrowser: false,
    requireCaptcha: false,
  },
  questions: [
    {
      id: "q1",
      type: "short-answer",
      title: "What is your name?",
      required: true,
      order: 0,
      sectionId: "s1",
    },
    {
      id: "q2",
      type: "multiple-choice",
      title: "How did you hear about us?",
      required: false,
      order: 1,
      sectionId: "s2",
      options: [
        { id: "o1", label: "A friend" },
        { id: "o2", label: "Search engine" },
      ],
    },
  ],
  sections: [
    { id: "s1", title: "About you", order: 0 },
    { id: "s2", title: "Preferences", order: 1 },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

type Json = Record<string, unknown>;

/**
 * Stub every `/api/*` call the public player makes. Returns the captured
 * submit payload (if any) for assertions.
 */
export async function mockPublicSurvey(
  page: Page,
  survey: Json = MOCK_SURVEY,
): Promise<{ submitted: Json[] }> {
  const submitted: Json[] = [];

  const envelope = (data: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      success: status < 400,
      data,
      error: status < 400 ? null : "error",
    }),
  });

  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/begin")) {
      return route.fulfill(envelope({ token: "begin-token" }));
    }
    if (url.includes("/track")) {
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.includes("/responses") && method === "POST") {
      submitted.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill(
        envelope(
          {
            id: "response-e2e",
            submittedAt: new Date().toISOString(),
            answers: [],
          },
          201,
        ),
      );
    }
    if (url.includes("/public/surveys/")) {
      return route.fulfill(envelope(survey));
    }
    return route.fulfill(envelope({}));
  });

  return { submitted };
}
