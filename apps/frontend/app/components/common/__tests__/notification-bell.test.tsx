import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppNotification } from "@/app/types/survey";

const markRead = vi.fn().mockResolvedValue(undefined);
const markAllRead = vi.fn().mockResolvedValue(undefined);
const push = vi.fn();

const state: {
  unreadCount: number;
  items: AppNotification[];
} = {
  unreadCount: 0,
  items: [],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "u1", email: "u1@example.com" } }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useUnreadNotificationCount: () => ({ data: state.unreadCount }),
  useNotifications: () => ({ data: { items: state.items, total: state.items.length } }),
  useMarkNotificationRead: () => ({ mutateAsync: markRead }),
  useMarkAllNotificationsRead: () => ({ mutate: markAllRead }),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { NotificationBell } from "../notification-bell";

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    eventType: "new_response",
    title: "You received a new response.",
    body: null,
    link: "/surveys/s1/results",
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  markRead.mockClear();
  markAllRead.mockClear();
  push.mockClear();
  state.unreadCount = 0;
  state.items = [];
});

describe("NotificationBell", () => {
  it("shows no badge when there are no unread notifications", () => {
    render(<NotificationBell />);
    expect(screen.queryByText("9+")).toBeNull();
    // No numeric badge text rendered either.
    expect(screen.getByRole("button", { name: "notifications.bell.label" })).toBeTruthy();
  });

  it("shows the unread count badge", () => {
    state.unreadCount = 3;
    render(<NotificationBell />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("caps the badge at 9+", () => {
    state.unreadCount = 42;
    render(<NotificationBell />);
    expect(screen.getByText("9+")).toBeTruthy();
  });

  it("opens the list, marks an item read, and navigates to its link", async () => {
    const user = userEvent.setup();
    state.unreadCount = 1;
    state.items = [notification()];
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "notifications.bell.label" }));
    const item = await screen.findByText("You received a new response.");
    await user.click(item);

    expect(markRead).toHaveBeenCalledWith("n1");
  });

  it("empty state renders when there are no items", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "notifications.bell.label" }));
    expect(await screen.findByText("notifications.empty")).toBeTruthy();
  });
});
