import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { LiveSession } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k}:${Object.entries(vars).map(([a, b]) => `${a}=${b}`).join(",")}` : k,
    locale: "en",
  }),
}));

// Radix Select doesn't open in jsdom; a native <select> keeps the contract.
vi.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: ReactNode }) => (
    <select aria-label="results.session.label" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import { SessionPicker } from "../session-picker";

afterEach(cleanup);

const sessions: LiveSession[] = [
  { id: "new", startedAt: "2026-09-23T20:45:00Z", responses: 6, players: 3 },
  { id: "old", startedAt: "2026-09-22T18:00:00Z", responses: 10, players: 5 },
];

describe("SessionPicker", () => {
  it("is hidden when the quiz has never been played as a live game", () => {
    const { container } = render(<SessionPicker sessions={[]} value={null} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("offers all rounds plus each round with its player count", () => {
    render(<SessionPicker sessions={sessions} value={null} onChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toBe("results.session.all");
    expect(options[1]).toContain("players=3");
    expect(options[2]).toContain("players=5");
    expect(screen.getByRole("combobox")).toHaveProperty("value", "__all__");
  });

  it("reports the picked round, and null for all rounds", () => {
    const onChange = vi.fn();
    render(<SessionPicker sessions={sessions} value="new" onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "old" } });
    expect(onChange).toHaveBeenLastCalledWith("old");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__all__" } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
