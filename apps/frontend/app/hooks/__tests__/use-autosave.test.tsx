import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "@/app/hooks/use-autosave";
import type { Survey, UpdateSurveyRequest } from "@/app/types/survey";

const survey = { id: "s1", title: "T" } as unknown as Survey;
const toRequest = (s: Survey) => ({ title: s.title }) as UpdateSurveyRequest;

function setup(overrides: Partial<Parameters<typeof useAutosave>[0]> = {}) {
  const save = vi.fn().mockResolvedValue(survey);
  const args = {
    enabled: true,
    ready: true,
    locallyDirty: true,
    survey,
    save,
    toRequest,
    ...overrides,
  };
  const view = renderHook((p: Parameters<typeof useAutosave>[0]) => useAutosave(p), {
    initialProps: args,
  });
  return { save, view, args };
}

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves once after the debounce when locally dirty", async () => {
    const { save } = setup();
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does NOT save when only remote-dirty (locallyDirty false)", async () => {
    const { save } = setup({ locallyDirty: false });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("does NOT save before the doc is ready", async () => {
    const { save } = setup({ ready: false });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("does NOT save when disabled", async () => {
    const { save } = setup({ enabled: false });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("flush() saves immediately", async () => {
    const { save, view } = setup();
    await act(async () => {
      view.result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending save on unmount", async () => {
    const { save, view } = setup();
    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(save).not.toHaveBeenCalled();
  });
});
