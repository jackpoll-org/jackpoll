import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { vi } from "vitest";

let reducedMotion = false;
vi.mock("@/app/lib/survey/a11y", () => ({
  prefersReducedMotion: () => reducedMotion,
}));

import { CountUp } from "../count-up";

beforeEach(() => {
  cleanup();
  reducedMotion = false;
});

describe("CountUp", () => {
  it("tweens up to the target value", async () => {
    render(<CountUp value={42} duration={0.1} />);
    await waitFor(() => expect(screen.getByText("42")).toBeTruthy(), { timeout: 2000 });
  });

  it("jumps straight to the target value under reduced motion", async () => {
    reducedMotion = true;
    render(<CountUp value={7} />);
    await waitFor(() => expect(screen.getByText("7")).toBeTruthy());
  });

  it("re-tweens when the value changes on an already-mounted instance", async () => {
    const { rerender } = render(<CountUp value={1} duration={0.1} />);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
    rerender(<CountUp value={9} duration={0.1} />);
    await waitFor(() => expect(screen.getByText("9")).toBeTruthy(), { timeout: 2000 });
  });
});
