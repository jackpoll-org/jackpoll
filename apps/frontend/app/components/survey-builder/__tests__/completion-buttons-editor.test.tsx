import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { CompletionButton, SurveySettings } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { CompletionButtonsEditor } from "../completion-buttons-editor";

const a: CompletionButton = { id: "a", label: "First", action: "close", enabled: true };
const b: CompletionButton = { id: "b", label: "Second", action: "url", url: "https://e.com", enabled: true };

function setup(settings: Partial<SurveySettings>) {
  const onChange = vi.fn();
  render(<CompletionButtonsEditor settings={settings as SurveySettings} onChange={onChange} />);
  return onChange;
}

afterEach(cleanup);

describe("CompletionButtonsEditor", () => {
  it("adds an enabled link button", () => {
    const onChange = setup({});
    fireEvent.click(screen.getByRole("button", { name: /builder.completionButtons.add/ }));
    expect(onChange).toHaveBeenCalledWith({
      completionButtons: [expect.objectContaining({ label: "", action: "url", enabled: true })],
    });
  });

  it("stops adding at the maximum", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...a, id: String(i) }));
    setup({ completionButtons: ten });
    expect(screen.getByRole("button", { name: /builder.completionButtons.add/ })).toBeDisabled();
  });

  it("edits, reorders, disables and removes buttons", () => {
    const onChange = setup({ completionButtons: [a, b] });
    fireEvent.change(screen.getAllByLabelText("builder.completionButtons.label")[0], {
      target: { value: "Renamed" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      completionButtons: [{ ...a, label: "Renamed" }, b],
    });
    fireEvent.click(screen.getAllByRole("button", { name: "builder.completionButtons.moveDown" })[0]);
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [b, a] });
    fireEvent.click(screen.getAllByRole("button", { name: "builder.completionButtons.moveUp" })[1]);
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [b, a] });
    fireEvent.click(screen.getAllByRole("switch", { name: "builder.completionButtons.enabled" })[1]);
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [a, { ...b, enabled: false }] });
    fireEvent.click(screen.getAllByRole("button", { name: "builder.completionButtons.remove" })[0]);
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [b] });
  });

  it("edits the link and new-tab choice for link buttons only", () => {
    const onChange = setup({ completionButtons: [a, b] });
    expect(screen.getAllByLabelText("builder.completionButtons.url")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("builder.completionButtons.url"), {
      target: { value: "https://x.org" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [a, { ...b, url: "https://x.org" }] });
    fireEvent.click(screen.getByRole("switch", { name: "builder.completionButtons.newTab" }));
    expect(onChange).toHaveBeenLastCalledWith({ completionButtons: [a, { ...b, newTab: true }] });
  });

  it("flags an unsafe link", () => {
    setup({ completionButtons: [{ ...b, url: "javascript:alert(1)" }] });
    expect(screen.getByText("builder.completionButtons.urlInvalid")).toBeTruthy();
  });

  it("explains when restart cannot be shown", () => {
    setup({ onePerBrowser: true, completionButtons: [{ ...a, action: "restart" }] });
    expect(screen.getByText("builder.completionButtons.restartUnavailable")).toBeTruthy();
  });

  it("shows, hides and renames the submit another button", () => {
    const onChange = setup({});
    fireEvent.click(screen.getByRole("switch", { name: "builder.completionButtons.showSubmitAnother" }));
    expect(onChange).toHaveBeenLastCalledWith({ hideSubmitAnother: true });
    fireEvent.change(screen.getByLabelText("builder.completionButtons.submitAnotherLabel"), {
      target: { value: "Again" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ submitAnotherLabel: "Again" });
  });
});
