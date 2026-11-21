import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { Survey } from "@/app/types/survey";

const organize = vi.fn().mockResolvedValue(undefined);
let surveys = [
  { id: "a", title: "A", tags: ["exam", "math"] },
  { id: "b", title: "B", tags: ["biology"] },
] as Survey[];
const useSurveys = vi.fn(() => ({ data: { surveys } }));

vi.mock("@/app/hooks/survey", () => ({
  useFolders: () => ({ data: [] }),
  useOrganizeSurvey: () => ({ mutateAsync: organize, isPending: false }),
  useSurveys: () => useSurveys(),
}));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string | number>) =>
      vars ? `${k}:${Object.values(vars).join(",")}` : k,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { OrganizeDialog } from "../organize-dialog";

afterEach(cleanup);

function openDialog(tags: string[]) {
  render(<OrganizeDialog survey={{ id: "a", title: "A", tags } as Survey} />);
  fireEvent.click(screen.getByRole("button", { name: "organize.trigger:A" }));
}

function suggested() {
  const group = screen.queryByRole("group", { name: "organize.suggestions" });
  return group ? within(group).getAllByRole("button").map((b) => b.textContent) : [];
}

describe("OrganizeDialog", () => {
  it("loads tag suggestions only once the dialog is open", () => {
    useSurveys.mockClear();
    render(<OrganizeDialog survey={{ id: "a", title: "A", tags: [] as string[] } as Survey} />);
    expect(useSurveys).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "organize.trigger:A" }));
    expect(useSurveys).toHaveBeenCalled();
  });

  it("suggests existing tags that match the draft and adds a picked one", async () => {
    openDialog(["exam"]);
    expect(suggested()).toEqual(["biology", "math"]);

    fireEvent.change(screen.getByPlaceholderText("organize.tagPlaceholder"), { target: { value: "MA" } });
    const group = screen.getByRole("group", { name: "organize.suggestions" });
    fireEvent.click(within(group).getByRole("button", { name: "math" }));
    expect(screen.getByPlaceholderText("organize.tagPlaceholder")).toHaveValue("");
    expect(screen.getByRole("button", { name: "organize.removeTag:math" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await vi.waitFor(() =>
      expect(organize).toHaveBeenCalledWith({ id: "a", tags: ["exam", "math"], folderId: null }),
    );
  });

  it("suggests a tag only once when other surveys use it in different cases", () => {
    const previous = surveys;
    surveys = [
      { id: "c", title: "C", tags: ["Work"] },
      { id: "d", title: "D", tags: ["work"] },
    ] as Survey[];
    try {
      openDialog([]);
      expect(suggested()).toHaveLength(1);
    } finally {
      surveys = previous;
    }
  });

  it("skips tags the survey already has in another case and caps the list", () => {
    const previous = surveys;
    surveys = [
      { id: "c", title: "C", tags: ["Exam", ...Array.from({ length: 10 }, (_, i) => `t${i}`)] },
    ] as Survey[];
    try {
      openDialog(["exam"]);
      expect(suggested()).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"]);
    } finally {
      surveys = previous;
    }
  });
});
