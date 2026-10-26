import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const replace = vi.fn();
const getLaunchUrl = vi.fn();

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: () => Promise.resolve({ remove: vi.fn() }),
    getLaunchUrl,
  },
}));

import { DeepLinks } from "../deep-links";

describe("DeepLinks cold start", () => {
  beforeEach(() => {
    replace.mockReset();
    sessionStorage.clear();
    getLaunchUrl.mockResolvedValue({ url: "https://app.jackpoll.org/s/abc123" });
  });

  it("opens the survey the app was launched with instead of the start page", async () => {
    render(<DeepLinks />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/s/abc123"));
  });

  it("does not reopen the launch link after a reload in the same session", async () => {
    const first = render(<DeepLinks />);
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<DeepLinks />);
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
