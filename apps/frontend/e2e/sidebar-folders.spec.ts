import { test, expect, type Page } from "@playwright/test";

const USER = {
  id: "me",
  email: "e2e@example.com",
  name: "E2E",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};

function survey(
  id: string,
  title: string,
  status: string,
  folderId: string | null = null,
  tags: string[] = [],
) {
  return {
    id,
    ownerId: USER.id,
    title,
    status,
    folderId,
    tags,
    settings: {},
    questions: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const TEMPLATE = {
  id: "t1",
  name: "Weekly check-in",
  description: "",
  questions: [],
  settings: null,
  sections: null,
  updatedAt: "2026-01-01T00:00:00Z",
};

const SURVEYS = [
  survey("s1", "Intro quiz", "draft", null, ["exam"]),
  survey("s2", "Feedback form", "published"),
  survey("s3", "Optics test", "draft", "f1", ["exam", "lab"]),
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
    const method = route.request().method();
    if (pathname.endsWith("/auth/me")) return envelope({ user: USER });
    if (pathname.endsWith("/surveys") && method === "POST") {
      return envelope(survey("new1", TEMPLATE.name, "draft"));
    }
    if (pathname.endsWith("/surveys/new1")) return envelope(survey("new1", TEMPLATE.name, "draft"));
    if (pathname.endsWith("/templates")) return envelope([TEMPLATE]);
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
    await expect(page).toHaveURL(/\/surveys\?status=closed&folder=none$/);
    await expect(main.getByText("Archived 50")).toBeVisible();
    await expect(main.getByText("Intro quiz")).toBeHidden();
    await expect(main.getByRole("combobox", { name: "Filter by status" })).toContainText("Closed");
  });

  test("All surveys and Unorganized open the matching dashboard view", async ({ page }) => {
    await page.goto("/surveys?folder=f1&lang=en");
    const nav = sidebar(page);
    const main = page.locator("main");

    await nav.getByRole("link", { name: "Unorganized" }).click();
    await expect(page).toHaveURL(/\/surveys\?folder=none$/);
    await expect(main.getByText("Intro quiz")).toBeVisible();
    await expect(main.getByText("Optics test")).toBeHidden();
    await expect(main.getByRole("button", { name: "Open folder Physics" })).toBeHidden();

    await main.getByPlaceholder("Search surveys…").fill("Optics");
    await expect(main.getByText("Optics test")).toBeVisible();
    await expect(main.getByText("Intro quiz")).toBeHidden();
    await main.getByPlaceholder("Search surveys…").fill("");

    await nav.getByRole("link", { name: "All surveys" }).click();
    await expect(page).toHaveURL(/\/surveys\?folder=all$/);
    await expect(nav.getByRole("link", { name: "All surveys" })).toHaveAttribute("data-active", "true");
    await expect(main.getByText("Intro quiz")).toBeVisible();
    await expect(main.getByText("Optics test")).toBeVisible();
    await expect(main.getByText("Mechanics exam")).toBeVisible();
    await expect(main.getByRole("button", { name: "Open folder Physics" })).toBeHidden();
  });

  test("a tag link filters the dashboard across folders", async ({ page }) => {
    await page.goto("/surveys?lang=en");
    const nav = sidebar(page);
    const main = page.locator("main");

    await nav.getByRole("button", { name: "Expand or collapse Tags" }).click();
    await nav.getByRole("link", { name: /^exam/ }).click();
    await expect(page).toHaveURL(/\/surveys\?tag=exam$/);
    await expect(main.getByText("Intro quiz")).toBeVisible();
    await expect(main.getByText("Optics test")).toBeVisible();
    await expect(main.getByText("Feedback form")).toBeHidden();
  });

  test("a tag filter highlights the tag instead of the folder", async ({ page }) => {
    await page.goto("/surveys?folder=f1&tag=lab&lang=en");
    const nav = sidebar(page);

    await expect(nav.getByRole("link", { name: "Physics" })).toHaveAttribute("data-active", "false");
    await nav.getByRole("button", { name: "Expand or collapse Tags" }).click();
    await expect(nav.getByRole("link", { name: /^lab/ })).toHaveAttribute("data-active", "true");
  });

  test("a template entry starts a new survey from it", async ({ page }) => {
    await page.goto("/surveys?lang=en");
    const nav = sidebar(page);
    const created = page.waitForRequest(
      (req) => req.method() === "POST" && new URL(req.url()).pathname.endsWith("/surveys"),
    );

    await nav.getByRole("button", { name: "Expand or collapse Templates" }).click();
    await nav.getByRole("button", { name: "New survey from “Weekly check-in”" }).click();
    expect((await created).postDataJSON()).toEqual({ title: "Weekly check-in" });
    await expect(page).toHaveURL(/\/surveys\/new1\/edit$/);
  });

  test("a template that cannot be applied leaves no blank survey behind", async ({ page }) => {
    await page.route("**/api/surveys/new1", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ success: route.request().method() === "DELETE", data: null, error: "boom" }),
      }),
    );
    await page.goto("/surveys?lang=en");
    const nav = sidebar(page);
    const deleted = page.waitForRequest(
      (req) => req.method() === "DELETE" && new URL(req.url()).pathname.endsWith("/surveys/new1"),
    );

    await nav.getByRole("button", { name: "Expand or collapse Templates" }).click();
    await nav.getByRole("button", { name: "New survey from “Weekly check-in”" }).click();
    await deleted;
    await expect(page.getByText("boom")).toBeVisible();
    await expect(page).not.toHaveURL(/\/edit$/);
  });

  test("dragging a survey onto a sidebar folder moves it there", async ({ page }) => {
    await page.goto("/surveys?folder=none&lang=en");
    const nav = sidebar(page);
    const target = nav.getByRole("link", { name: "Physics" });
    const organized = page.waitForRequest(
      (req) => req.method() === "PUT" && new URL(req.url()).pathname.endsWith("/surveys/s1/organize"),
    );

    const grip = page.getByRole("button", { name: /Intro quiz/ }).filter({ has: page.locator("svg") }).first();
    const from = (await grip.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
    await expect(target).toHaveAttribute("data-drop-over", "true");
    await page.mouse.up();

    expect((await organized).postDataJSON()).toEqual({ tags: ["exam"], folderId: "f1" });
    await expect(target).not.toHaveAttribute("data-drop-over");
  });

  test("the sidebar divider resizes the sidebar and remembers the width", async ({ page }) => {
    await page.goto("/surveys?lang=en");
    const handle = page.getByRole("separator", { name: "Resize sidebar" });
    const container = page.locator("[data-slot=sidebar-container]");
    await expect(handle).toHaveAttribute("aria-valuenow", "256");

    const box = (await handle.boundingBox())!;
    const grabX = box.x + 1;
    await page.mouse.move(grabX, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(grabX + 64, box.y + 200, { steps: 10 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    await expect.poll(async () => Math.round((await container.boundingBox())!.width)).toBe(320);

    const moved = (await handle.boundingBox())!;
    await page.mouse.move(moved.x + moved.width / 2, moved.y + 200);
    await page.mouse.down();
    await page.mouse.move(1000, moved.y + 200, { steps: 5 });
    await page.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "400");

    await page.reload();
    await expect(handle).toHaveAttribute("aria-valuenow", "400");
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "384");
    await expect.poll(async () => Math.round((await container.boundingBox())!.width)).toBe(384);
    await handle.dblclick();
    await expect(handle).toHaveAttribute("aria-valuenow", "256");
  });

  for (const view of ["Grid view", "List view"]) {
    test(`a sidebar drop goes to the folder under the pointer (${view})`, async ({ page }) => {
      await page.route("**/api/**/folders", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: [
              { id: "f1", name: "Physics" },
              { id: "f2", name: "Chemistry" },
              { id: "f3", name: "Biology" },
            ],
            error: null,
          }),
        }),
      );
      await page.goto("/surveys?folder=none&lang=en");
      await page.getByLabel(view).click();
      const target = sidebar(page).getByRole("link", { name: "Chemistry" });
      const organized = page.waitForRequest(
        (req) => req.method() === "PUT" && new URL(req.url()).pathname.endsWith("/surveys/s1/organize"),
      );

      const grip = page.getByRole("button", { name: /Intro quiz/ }).filter({ has: page.locator("svg") }).first();
      const from = (await grip.boundingBox())!;
      const to = (await target.boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
      await expect(target).toHaveAttribute("data-drop-over", "true");
      await page.mouse.up();

      expect((await organized).postDataJSON()).toEqual({ tags: ["exam"], folderId: "f2" });
    });
  }
});
