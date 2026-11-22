import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { PaletteDialog } from "../chart-colors-dialog";

afterEach(cleanup);

function dialog(palette: string[]) {
  return (
    <PaletteDialog
      trigger={<button type="button">open</button>}
      title="Colors"
      help=""
      palette={palette}
      resetLabel="reset"
      savedMessage="saved"
      resetMessage="reset done"
      onSave={vi.fn()}
    />
  );
}

describe("PaletteDialog", () => {
  it("keeps in-progress picks when the palette prop is replaced by an equal array", () => {
    const { rerender } = render(dialog(["#111111", "#222222"]));
    fireEvent.click(screen.getByText("open"));
    const first = screen.getByLabelText("1") as HTMLInputElement;
    expect(first.value).toBe("#111111");
    fireEvent.change(first, { target: { value: "#abcdef" } });

    rerender(dialog(["#111111", "#222222"]));

    expect((screen.getByLabelText("1") as HTMLInputElement).value).toBe("#abcdef");
  });
});
