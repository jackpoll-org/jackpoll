import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

let mobile = false;
vi.mock("@/app/hooks/use-mobile", () => ({ useIsMobile: () => mobile }));
vi.mock("@/app/i18n/context", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { SidebarProvider } from "@/app/components/ui/sidebar";
import { SidebarResizeHandle } from "../sidebar-resize-handle";

function renderHandle() {
  const utils = render(
    <SidebarProvider>
      <SidebarResizeHandle />
    </SidebarProvider>,
  );
  const wrapper = utils.container.querySelector<HTMLElement>("[data-slot=sidebar-wrapper]")!;
  return { wrapper, width: () => wrapper.style.getPropertyValue("--sidebar-width") };
}

beforeEach(() => {
  localStorage.clear();
  mobile = false;
});
afterEach(cleanup);

describe("SidebarResizeHandle", () => {
  it("starts from the stored width", () => {
    localStorage.setItem("ui_sidebar_width", "300");
    const { width } = renderHandle();
    expect(width()).toBe("300px");
    expect(screen.getByRole("separator", { name: "ui.sidebar.resize" })).toHaveAttribute("aria-valuenow", "300");
  });

  it("resizes with the keyboard within bounds, persists, and resets on double-click", () => {
    const { width } = renderHandle();
    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuemin", "208");
    expect(handle).toHaveAttribute("aria-valuemax", "400");

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(width()).toBe("272px");
    expect(localStorage.getItem("ui_sidebar_width")).toBe("272");

    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "400");

    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(width()).toBe("208px");

    fireEvent.doubleClick(handle);
    expect(width()).toBe("256px");
    expect(localStorage.getItem("ui_sidebar_width")).toBe("256");
  });

  it("is not rendered on mobile", () => {
    mobile = true;
    renderHandle();
    expect(screen.queryByRole("separator")).toBeNull();
  });
});
