import { test, expect, type Page } from "@playwright/test";
import { MOCK_SURVEY } from "./mocks";

const USER = {
  id: "owner-1",
  email: "e2e@example.com",
  name: "E2E",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const SURVEY = {
  ...MOCK_SURVEY,
  questions: [{ id: "q1", type: "short-answer", title: "Your class?", required: false, order: 0 }],
  sections: [],
};

const openRun = (id: string, label: string) => ({
  id,
  label,
  opensAt: "2026-01-01T08:00:00Z",
  closesAt: "2030-01-01T08:00:00Z",
  status: "open",
});

type Json = Record<string, unknown>;

function envelope(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data, error: null }),
  };
}

async function routeBuilder(page: Page, created: Json[]) {
  await page.context().addCookies([
    { name: "survey-auth-token", value: "e2e-token", domain: "localhost", path: "/" },
  ]);
  await page.addInitScript((user) => {
    localStorage.setItem("survey-auth-token", "e2e-token");
    localStorage.setItem("survey-auth-user", JSON.stringify(user));
  }, USER);
  const runs: Json[] = [];
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname.endsWith("/auth/me")) return route.fulfill(envelope({ user: USER }));
    if (pathname.endsWith(`/surveys/${SURVEY.id}/runs`) && method === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      created.push(body);
      const run = { id: "run-new", ...body, closedAt: null, status: "scheduled", responseCount: 0, snapshotAt: null };
      runs.push(run);
      return route.fulfill(envelope(run, 201));
    }
    if (pathname.endsWith(`/surveys/${SURVEY.id}/runs`)) return route.fulfill(envelope(runs));
    if (pathname.endsWith(`/surveys/${SURVEY.id}/share-link`)) {
      return route.fulfill(envelope({ slug: "abc", responseCount: 0 }));
    }
    if (pathname.endsWith(`/surveys/${SURVEY.id}`)) return route.fulfill(envelope(SURVEY));
    if (pathname.endsWith("/surveys")) return route.fulfill(envelope([]));
    return route.fulfill(envelope([]));
  });
}

test.describe("scheduled runs", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "locale", value: "en", domain: "localhost", path: "/" }]);
  });

  test("creates a run in the builder settings", async ({ page }) => {
    const created: Json[] = [];
    await routeBuilder(page, created);
    await page.goto(`/surveys/${SURVEY.id}/edit`);

    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Add run" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Label").fill("School year 2026/27");
    await dialog.getByLabel("Opens at").fill("2026-09-01T08:00");
    await dialog.getByLabel("Closes at").fill("2027-07-01T16:00");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("run-row")).toContainText("School year 2026/27");
    await expect(page.getByTestId("run-row")).toContainText("Scheduled");
    expect(created).toHaveLength(1);
    expect(created[0].label).toBe("School year 2026/27");
    expect(Date.parse(String(created[0].opensAt))).toBeLessThan(Date.parse(String(created[0].closesAt)));
  });

  test("picks one of two open runs and submits with its id", async ({ page }) => {
    const submitted: Json[] = [];
    const fetched: string[] = [];
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (url.pathname.includes("/public/links/")) {
        fetched.push(url.search);
        const runs = [openRun("a", "Class A"), openRun("b", "Class B")];
        const served = runs.find((r) => r.id === url.searchParams.get("run")) ?? null;
        return route.fulfill(envelope({ ...SURVEY, runs, run: served }));
      }
      if (url.pathname.endsWith("/responses") && method === "POST") {
        submitted.push(JSON.parse(route.request().postData() ?? "{}"));
        return route.fulfill(envelope({ id: "r1", submittedAt: new Date().toISOString(), answers: [] }, 201));
      }
      if (url.pathname.includes("/begin")) return route.fulfill(envelope({ token: "begin-token" }));
      if (url.pathname.includes("/track")) return route.fulfill({ status: 204, body: "" });
      return route.fulfill(envelope({}));
    });

    await page.goto("/s/abc");
    await expect(page.getByText("Several runs are open. Please choose yours:")).toBeVisible();
    await page.getByRole("button", { name: "Class B" }).click();

    await expect(page).toHaveURL(/\/s\/abc\?run=b$/);
    await expect(page.getByText("Your class?")).toBeVisible();
    expect(fetched).toContain("?run=b");
    await page.getByRole("textbox").first().fill("7b");
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(page.getByText("Thanks — your response was recorded!")).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].runId).toBe("b");
  });

  test("an access code opens the run picker and submits with the picked run", async ({ page }) => {
    const submitted: Json[] = [];
    const runs = [openRun("a", "Class A"), openRun("b", "Class B")];
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      if (url.pathname.endsWith("/public/access-code")) {
        return route.fulfill(
          envelope({
            survey: { ...SURVEY, questions: [], sections: [], runs, run: null, hasRuns: true },
            accessToken: "access-token",
          }),
        );
      }
      if (url.pathname.endsWith(`/public/surveys/${SURVEY.id}`)) {
        const served = runs.find((r) => r.id === url.searchParams.get("run")) ?? null;
        const content = served ? {} : { questions: [] };
        return route.fulfill(envelope({ ...SURVEY, ...content, runs, run: served, hasRuns: true }));
      }
      if (url.pathname.endsWith("/responses") && method === "POST") {
        submitted.push(JSON.parse(route.request().postData() ?? "{}"));
        return route.fulfill(envelope({ id: "r1", submittedAt: new Date().toISOString(), answers: [] }, 201));
      }
      if (url.pathname.includes("/begin")) return route.fulfill(envelope({ token: "begin-token" }));
      if (url.pathname.includes("/track")) return route.fulfill({ status: 204, body: "" });
      return route.fulfill(envelope({}));
    });

    await page.goto("/join?code=ABCD2345");
    await expect(page.getByText("Several runs are open. Please choose yours:")).toBeVisible();
    await page.getByRole("button", { name: "Class B" }).click();

    await expect(page.getByText("Your class?")).toBeVisible();
    await page.getByRole("textbox").first().fill("7b");
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(page.getByText("Thanks — your response was recorded!")).toBeVisible();
    expect(submitted).toHaveLength(1);
    expect(submitted[0].runId).toBe("b");
  });
});
