import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { NotificationPreferences } from "@/app/types/survey";

const mutateAsync = vi.fn().mockResolvedValue(undefined);
const query: { data: NotificationPreferences | undefined; isLoading: boolean; isError: boolean } = {
  data: { byEvent: {} },
  isLoading: false,
  isError: false,
};

vi.mock("@/app/hooks/survey", () => ({
  useNotificationPrefs: () => query,
  useUpdateNotificationPrefs: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { NotificationSettingsPage } from "../notification-settings-page";

beforeEach(() => {
  cleanup();
  mutateAsync.mockClear();
  query.isLoading = false;
  query.isError = false;
  query.data = { byEvent: {} };
});

describe("NotificationSettingsPage", () => {
  it("renders all 9 events with a switch per valid channel", () => {
    render(<NotificationSettingsPage />);

    // 9 events total.
    expect(screen.getByText("settings.notify.newResponse")).toBeTruthy();
    expect(screen.getByText("settings.notify.dailyDigest")).toBeTruthy();
    expect(screen.getByText("settings.notify.collaboratorInvited")).toBeTruthy();
    expect(screen.getByText("settings.notify.collaboratorAccepted")).toBeTruthy();
    expect(screen.getByText("settings.notify.collaboratorDeclined")).toBeTruthy();
    expect(screen.getByText("settings.notify.collaboratorRemoved")).toBeTruthy();
    expect(screen.getByText("settings.notify.responseMilestone")).toBeTruthy();
    expect(screen.getByText("settings.notify.surveyAutoClosed")).toBeTruthy();
    expect(screen.getByText("settings.notify.webhookFailing")).toBeTruthy();

    // 8 events x 4 channels + 1 digest x 1 channel = 33 switches.
    expect(screen.getAllByRole("switch")).toHaveLength(33);
    // Daily digest shows "—" for the 3 channels it doesn't support.
    expect(screen.getAllByText("settings.notify.na")).toHaveLength(3);
  });

  it("defaults every switch to checked when no override exists", () => {
    render(<NotificationSettingsPage />);
    const switches = screen.getAllByRole("switch");
    for (const s of switches) {
      expect(s.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("toggling a cell saves only that (event, channel) as an override", () => {
    render(<NotificationSettingsPage />);
    const emailSwitch = screen.getByRole("switch", {
      name: "settings.notify.collaboratorInvited – settings.notify.colEmail",
    });
    fireEvent.click(emailSwitch);
    expect(mutateAsync).toHaveBeenCalledWith({
      byEvent: { collaborator_invited: { email: false } },
    });
  });

  it("shows an error message when loading fails", () => {
    query.isError = true;
    render(<NotificationSettingsPage />);
    expect(screen.getByText("settings.notify.loadFailed")).toBeTruthy();
  });
});
