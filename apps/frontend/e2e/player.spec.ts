import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MOCK_SURVEY, mockPublicSurvey } from "./mocks";

const EMBED = `/embed/${MOCK_SURVEY.id}`;

test.describe("survey player", () => {
  // English UI for stable assertions (the app defaults to German). The cookie
  // is read server-side, so the first render is already English.
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "locale", value: "en", domain: "localhost", path: "/" },
    ]);
  });

  test("completes a multi-page survey and submits", async ({ page }) => {
    const ctx = await mockPublicSurvey(page);
    await page.goto(EMBED);

    await expect(
      page.getByRole("heading", { name: "Customer Feedback" }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Step 1 of 2" })).toBeVisible();

    // Required short-answer left blank → advancing is blocked with an alert.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Step 1 of 2" })).toBeVisible();

    // Fill it in and advance to page two.
    await page.getByRole("textbox").first().fill("Ada Lovelace");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "Step 2 of 2" })).toBeVisible();
    await expect(
      page.getByText("How did you hear about us?"),
    ).toBeVisible();

    // Pick an option and submit.
    await page.getByText("A friend").click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    await expect(
      page.getByText("Thanks — your response was recorded!"),
    ).toBeVisible();
    expect(ctx.submitted.length).toBe(1);
  });

  test("keyboard-only user can navigate back and forth", async ({ page }) => {
    await mockPublicSurvey(page);
    await page.goto(EMBED);

    await page.getByRole("textbox").first().fill("Grace Hopper");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "Step 2 of 2" })).toBeVisible();

    // The answer is retained when returning to the previous page.
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "Step 1 of 2" })).toBeVisible();
    await expect(page.getByRole("textbox").first()).toHaveValue("Grace Hopper");
  });

  test("has no critical accessibility violations", async ({ page }) => {
    await mockPublicSurvey(page);
    await page.goto(EMBED);
    await expect(
      page.getByRole("heading", { name: "Customer Feedback" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
