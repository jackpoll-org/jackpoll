import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TimerRing } from "../timer-ring";

beforeEach(() => cleanup());

describe("TimerRing", () => {
  it("renders nothing when there's no timer", () => {
    const { container } = render(<TimerRing remaining={null} fraction={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the remaining seconds", () => {
    render(<TimerRing remaining={12} fraction={0.6} />);
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("marks the low-time state at <= 5s", () => {
    render(<TimerRing remaining={5} fraction={0.1} />);
    expect(screen.getByText("5").className).toContain("text-destructive");
  });

  it("does not mark low-time above 5s", () => {
    render(<TimerRing remaining={6} fraction={0.3} />);
    expect(screen.getByText("6").className).not.toContain("text-destructive");
  });
});
