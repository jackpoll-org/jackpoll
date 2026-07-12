import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Accessibility audit of the public auth surfaces (#59). The dashboard/builder
// (authenticated) are covered by the full-stack suite (#58).
const ROUTES = ["/login", "/register", "/forgot-password"];

for (const route of ROUTES) {
  test(`no critical a11y violations: ${route}`, async ({ page }) => {
    await page.goto(`${route}?lang=en`);
    await expect(page.getByRole("button").first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
