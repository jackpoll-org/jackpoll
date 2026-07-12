import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Full-stack smoke (#58) — runs against a real app + backend (no mocks).
 * Public checks always run; the authenticated journey (which creates a real
 * Keycloak user) runs only when E2E_FULLSTACK=1 so it never fires against a
 * mocked/standalone frontend.
 */
const RUN_AUTH = process.env.E2E_FULLSTACK === "1";

test.describe("full-stack smoke", () => {
  test("public: an unknown survey shows the real not-available state", async ({
    page,
  }) => {
    await page.goto("/embed/does-not-exist-xyz?lang=en");
    await expect(page.getByText(/not available/i)).toBeVisible();
  });

  test("public: login page has no critical a11y violations (live)", async ({
    page,
  }) => {
    await page.goto("/login?lang=en");
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("authed: register → dashboard → start a survey", async ({ page }) => {
    test.skip(!RUN_AUTH, "set E2E_FULLSTACK=1 to run the authenticated journey");

    const email = `e2e-${Date.now()}@example.com`;
    const password = "TestPass123!";

    await page.goto("/register?lang=en");
    await page.getByLabel("Name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // Registration logs in and lands on the dashboard.
    await expect(page.getByRole("button", { name: "New survey" })).toBeVisible({
      timeout: 30_000,
    });

    // Dashboard a11y (authenticated chrome — sidebar, header, list).
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);

    // Create a blank survey → the builder opens.
    await page.getByRole("button", { name: "New survey" }).click();
    await page.getByText("Blank survey").click();
    await expect(page).toHaveURL(/\/surveys\/.+\/edit/, { timeout: 30_000 });
  });
});
