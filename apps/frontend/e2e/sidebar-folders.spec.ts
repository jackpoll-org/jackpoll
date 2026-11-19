import { test, expect, type Page } from "@playwright/test";

const USER = {
  id: "me",
  email: "e2e@example.com",
  name: "E2E",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};

function survey(id: string, title: string, status: string, folderId: string | null = null) {
  return {
    id,
    ownerId: USER.id,
    title,
    status,
    folderId,
    tags: [],
    settings: {},
    questions: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const SURVEYS = [
  survey("s1", "Intro quiz", "draft"),
  survey("s2", "Feedback form", "published"),
  survey("s3", "Optics test", "draft", "f1"),
  survey("s4", "Mechanics exam", "closed", "f1"),
  ...Array.from({ length: 51 }, (_, i) => survey(`p${i}`, `Archived ${i}`, "closed")),
];

async function signIn(page: Page) {
  await page.context().addCookies([
    { name: "survey-auth-token", value: "e2e-token", domain: "localhost", path: "/" },
  ]);
  await page.addInitScript((user) => {
    localStorage.setItem("survey-auth-token", "e2e-token");
    localStorage.setItem("survey-auth-user", JSON.stringify(user));
  }, USER);
  await page.route("**/api/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const envelope = (data: unknown, meta?: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: true, data, error: null, meta }),
      });
    if (pathname.endsWith("/auth/me")) return envelope({ user: USER });
    if (pathname.endsWith("/surveys")) {
      return envelope(SURVEYS, { total: SURVEYS.length, page: 0, limit: 1000 });
    }
    if (pathname.endsWith("/folders")) return envelope([{ id: "f1", name: "Physics" }]);
    return envelope([]);
  });
}

const sidebar = (page: Page) => page.locator("[data-sidebar=sidebar]");

test.describe("sidebar folders", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("lists folders with status groups and remembers a hidden group", async ({ page }) => {
    await page.goto("/surveys?lang=en");
    const nav = sidebar(page);
    await expect(nav.getByText("Intro quiz")).toBeVisible();
    await expect(nav.getByText("Feedback form")).toBeVisible();
    await expect(nav.getByText("Optics test")).toBeHidden();

    await nav.getByRole("button", { name: "Expand or collapse Physics", exact: true }).click();
    await expect(nav.getByText("Optics test")).toBeVisible();
    await expect(nav.getByText("Mechanics exam")).toBeVisible();

    await nav.getByRole("button", { name: "Options for Physics" }).click({ force: true });
    await page.getByRole("menuitemcheckbox", { name: "Closed" }).click();
    await page.keyboard.press("Escape");
    await expect(nav.getByText("Mechanics exam")).toBeHidden();

    await page.reload();
    await expect(nav.getByText("Optics test")).toBeVisible();
    await expect(nav.getByText("Mechanics exam")).toBeHidden();
  });

  test("folder and show-all links open the matching dashboard view", async ({ page }) => {
    await page.goto("/surveys?lang=en");
    const nav = sidebar(page);
    const main = page.locator("main");

    await nav.getByRole("link", { name: "Physics" }).click();
    await expect(page).toHaveURL(/\/surveys\?folder=f1$/);
    await expect(main.getByText("Optics test")).toBeVisible();
    await expect(main.getByText("Intro quiz")).toBeHidden();

    await nav.getByRole("link", { name: "Show all (51)" }).click();
    await expect(page).toHaveURL(/\/surveys\?status=closed$/);
    await expect(main.getByText("Archived 50")).toBeVisible();
    await expect(main.getByText("Intro quiz")).toBeHidden();
    await expect(main.getByRole("combobox", { name: "Filter by status" })).toContainText("Closed");
  });
});
