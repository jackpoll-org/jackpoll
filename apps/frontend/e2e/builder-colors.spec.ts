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
  status: "draft",
  questions: [{ id: "q1", type: "wordcloud", title: "One word?", required: false, order: 0, settings: { maxWords: 3 } }],
  sections: [],
};

type Json = Record<string, unknown>;

function envelope(data: unknown) {
  return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data, error: null }) };
}

async function routeBuilder(page: Page, saved: Json[]) {
  await page.context().addCookies([
    { name: "survey-auth-token", value: "e2e-token", domain: "localhost", path: "/" },
    { name: "locale", value: "en", domain: "localhost", path: "/" },
  ]);
  await page.addInitScript((user) => {
    localStorage.setItem("survey-auth-token", "e2e-token");
    localStorage.setItem("survey-auth-user", JSON.stringify(user));
  }, USER);
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname.endsWith("/auth/me")) return route.fulfill(envelope({ user: USER }));
    if (pathname.endsWith(`/surveys/${SURVEY.id}`) && method === "PUT") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      saved.push(body);
      return route.fulfill(envelope({ ...SURVEY, ...body }));
    }
    if (pathname.endsWith(`/surveys/${SURVEY.id}`)) return route.fulfill(envelope(SURVEY));
    return route.fulfill(envelope([]));
  });
}

test("chooses word cloud colors in the builder before any results exist", async ({ page }) => {
  const saved: Json[] = [];
  await routeBuilder(page, saved);
  await page.goto(`/surveys/${SURVEY.id}/edit`);

  await page.getByRole("button", { name: "Choose colors" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("1", { exact: true }).fill("#123456");
  await expect(dialog.getByTestId("palette-sample").locator("span").first()).toHaveCSS("color", "rgb(18, 52, 86)");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId("palette-sample").locator("span").first()).toHaveCSS("color", "rgb(18, 52, 86)");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => saved.length).toBeGreaterThan(0);
  const questions = saved.at(-1)?.questions as { settings: { colorPalette: string[] } }[];
  expect(questions[0].settings.colorPalette[0]).toBe("#123456");
  expect(questions[0].settings.colorPalette).toHaveLength(10);
  for (const color of questions[0].settings.colorPalette) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
});
