import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/app/hooks/survey", () => ({
  useAccessCode: () => ({ data: { code: "123456" } }),
}));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { LobbyView } from "../lobby-view";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LobbyView", () => {
  it("lets a plain live survey start right away, without a roster", () => {
    const onStart = vi.fn();
    render(<LobbyView surveyId="s1" onStart={onStart} />);

    expect(screen.getByText("123456")).toBeTruthy();
    expect(screen.queryByText("live.lobby.players")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "live.lobby.startPresentation" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("keeps a quiz game waiting until a player has joined", () => {
    const { rerender } = render(<LobbyView surveyId="s1" players={[]} onStart={vi.fn()} />);
    expect(screen.getByRole("button", { name: "live.lobby.start" })).toHaveProperty("disabled", true);

    rerender(<LobbyView surveyId="s1" players={["Ada"]} onStart={vi.fn()} />);
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByRole("button", { name: "live.lobby.start" })).toHaveProperty("disabled", false);
  });
});
