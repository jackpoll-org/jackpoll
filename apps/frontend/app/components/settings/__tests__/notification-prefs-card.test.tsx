import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { NotificationsLinkCard } from "../notification-prefs-card";

describe("NotificationsLinkCard", () => {
  it("links to the dedicated notification settings page", () => {
    render(<NotificationsLinkCard />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/settings/notifications");
    expect(screen.getByText("settings.notify.linkTitle")).toBeTruthy();
    expect(screen.getByText("settings.notify.linkDescription")).toBeTruthy();
  });
});
