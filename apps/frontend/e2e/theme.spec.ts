import { test, expect, type Page } from "@playwright/test";
import { MOCK_SURVEY, mockPublicSurvey } from "./mocks";

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
    await mockLink(page, {
      ...MOCK_SURVEY,
      settings: { ...MOCK_SURVEY.settings, backgroundColor: "#fef3c7" },
    } as typeof MOCK_SURVEY);
    await page.goto("/s/feedback");
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });

  test("the app outside public pages stays light by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });
});
