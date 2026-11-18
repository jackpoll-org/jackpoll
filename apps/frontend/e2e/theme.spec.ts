import { createServer } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import { API_PORT } from "../playwright.config";
import { MOCK_SURVEY, mockPublicSurvey } from "./mocks";

const BRANDED_SURVEY = {
  ...MOCK_SURVEY,
  settings: { ...MOCK_SURVEY.settings, backgroundColor: "#fef3c7" },
} as typeof MOCK_SURVEY;

function serveToLayout(slug: string, survey: typeof MOCK_SURVEY) {
  const server = createServer((req, res) => {
    const found = req.url === `/api/v1/public/links/${slug}`;
    res.writeHead(found ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(found ? { success: true, data: survey, error: null } : { success: false, data: null, error: "Not found" }));
  });
  return new Promise<() => Promise<void>>((resolve) =>
    server.listen(API_PORT, () => resolve(() => new Promise((done) => server.close(() => done())))),
  );
}

async function mockLink(page: Page, survey: typeof MOCK_SURVEY) {
  await mockPublicSurvey(page, survey);
  await page.route("**/api/public/links/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: survey, error: null }),
    }),
  );
}

test.describe("public colour mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
  });

  test("a shared survey follows a dark system preference", async ({ page }) => {
    await mockLink(page, MOCK_SURVEY);
    await page.goto("/s/feedback");
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("an embedded survey follows a dark system preference", async ({ page }) => {
    await mockPublicSurvey(page);
    await page.goto(`/embed/${MOCK_SURVEY.id}`);
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("a survey with a custom background stays light", async ({ page }) => {
    await mockLink(page, BRANDED_SURVEY);
    await page.goto("/s/feedback");
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("a survey with a custom background is never painted dark", async ({ page }) => {
    const close = await serveToLayout("branded", BRANDED_SURVEY);
    try {
      await mockLink(page, BRANDED_SURVEY);
      await page.addInitScript(() => {
        const painted: string[] = [];
        (window as unknown as { painted: string[] }).painted = painted;
        const sample = () => {
          painted.push(document.documentElement.className);
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.goto("/s/branded");
      await expect(page.getByText("What is your name?")).toBeVisible();
      const painted = await page.evaluate(() => (window as unknown as { painted: string[] }).painted);
      expect(painted.length).toBeGreaterThan(0);
      expect(painted.filter((className) => /\bdark\b/.test(className))).toEqual([]);
    } finally {
      await close();
    }
  });

  test("the app outside public pages stays light by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });
});
