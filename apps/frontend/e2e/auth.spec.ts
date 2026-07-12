import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test("renders the form and validates empty input client-side", async ({
    page,
  }) => {
    await page.goto("/login?lang=en");

    await expect(page.getByLabel("Email")).toBeVisible();
    const submit = page.getByRole("button", { name: "Login", exact: true });
    await expect(submit).toBeVisible();

    // Submitting empty triggers client-side (Zod) validation, no navigation.
    await submit.click();
    await expect(page.locator("p.text-destructive").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("links to password recovery", async ({ page }) => {
    await page.goto("/login?lang=en");
    await expect(
      page.getByRole("link", { name: "Forgot your password?" }),
    ).toBeVisible();
  });
});
