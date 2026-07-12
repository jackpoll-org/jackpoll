import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { NotificationPreferences } from "@/app/types/survey";

const mutateAsync = vi.fn().mockResolvedValue(undefined);
const query: { data: NotificationPreferences; isLoading: boolean; isError: boolean } = {
  data: {
    newResponse: { email: true, mobilePush: true, webPush: true },
    dailyDigest: { email: true },
  },
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

import { NotificationPrefsCard } from "../notification-prefs-card";

beforeEach(() => {
  cleanup();
  mutateAsync.mockClear();
  query.isLoading = false;
  query.isError = false;
  query.data = {
    newResponse: { email: true, mobilePush: true, webPush: true },
    dailyDigest: { email: true },
  };
});

describe("NotificationPrefsCard", () => {
  it("renders the events × channels matrix", () => {
    render(<NotificationPrefsCard />);
    expect(screen.getByText("settings.notify.newResponse")).toBeTruthy();
    expect(screen.getByText("settings.notify.dailyDigest")).toBeTruthy();
    // 4 switches: 3 for new response + 1 for daily digest email.
    expect(screen.getAllByRole("switch")).toHaveLength(4);
  });

  it("toggling a channel saves the updated preferences", () => {
    render(<NotificationPrefsCard />);
    const emailSwitch = screen.getByRole("switch", {
      name: "settings.notify.newResponse – settings.notify.colEmail",
    });
    fireEvent.click(emailSwitch);
    expect(mutateAsync).toHaveBeenCalledWith({
      newResponse: { email: false, mobilePush: true, webPush: true },
      dailyDigest: { email: true },
    });
  });

  it("shows an error message when loading fails", () => {
    query.isError = true;
    render(<NotificationPrefsCard />);
    expect(screen.getByText("settings.notify.loadFailed")).toBeTruthy();
  });
});
