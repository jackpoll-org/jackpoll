import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Option } from "@/app/types/survey";

vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string>) => (p?.label ? `${k}:${p.label}` : k),
  }),
}));

import { OptionListEditor } from "../editors/option-list-editor";

const options: Option[] = [
  { id: "a", label: "Red" },
  { id: "b", label: "Green" },
  { id: "c", label: "Blue" },
];

const ROW_HEIGHT = 40;

// jsdom has no layout: give every option row a stacked rect so dnd-kit's
// keyboard sensor can find the row below/above the dragged one.
let rectSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    const row = this.closest("[data-option-id]");
    const index = row ? options.findIndex((o) => o.id === row.getAttribute("data-option-id")) : 0;
    const top = index * ROW_HEIGHT;
    return {
      x: 0, y: top, top, left: 0, width: 300, height: ROW_HEIGHT,
      right: 300, bottom: top + ROW_HEIGHT, toJSON: () => ({}),
    } as DOMRect;
  });
});
afterEach(() => rectSpy.mockRestore());

/** Fire a keydown and let dnd-kit's async measuring/rAF settle. */
async function press(target: Element | Document, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code });
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe("OptionListEditor reordering (#10)", () => {
  it("renders a labelled drag handle per option", () => {
    render(<OptionListEditor label="Options" options={options} onChange={vi.fn()} />);
    for (const o of options) {
      expect(screen.getByRole("button", { name: `qedit.dragReorder:${o.label}` })).toBeTruthy();
    }
  });

  it("moves an option down with the keyboard", async () => {
    const onChange = vi.fn();
    render(<OptionListEditor label="Options" options={options} onChange={onChange} />);
    const handle = screen.getByRole("button", { name: "qedit.dragReorder:Red" });

    handle.focus();
    await press(handle, "Space"); // pick up
    await press(document, "ArrowDown");
    await press(document, "Space"); // drop

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((o: Option) => o.id)).toEqual(["b", "a", "c"]);
  });
});
