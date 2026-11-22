"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useSidebar } from "@/app/components/ui/sidebar";
import { useTranslation } from "@/app/i18n/context";
import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
} from "@/app/lib/preferences/sidebar-width";

const KEY_STEP = 16;

function setResizing(el: HTMLElement, on: boolean) {
  el.closest("[data-slot=sidebar-wrapper]")?.toggleAttribute("data-resizing", on);
}

export function SidebarResizeHandle() {
  const { t } = useTranslation();
  const { isMobile, width, setWidth } = useSidebar();
  const grabOffset = useRef(0);
  if (isMobile) return null;

  const sidebarLeft = (el: HTMLElement) => el.parentElement?.getBoundingClientRect().left ?? 0;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grabOffset.current = e.clientX - sidebarLeft(e.currentTarget) - width;
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(e.currentTarget, true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setWidth(e.clientX - sidebarLeft(e.currentTarget) - grabOffset.current);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setResizing(e.currentTarget, false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = {
      ArrowLeft: width - KEY_STEP,
      ArrowRight: width + KEY_STEP,
      Home: SIDEBAR_WIDTH_MIN,
      End: SIDEBAR_WIDTH_MAX,
      Enter: SIDEBAR_WIDTH_DEFAULT,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setWidth(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("ui.sidebar.resize")}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onDoubleClick={() => setWidth(SIDEBAR_WIDTH_DEFAULT)}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-sidebar-ring focus-visible:after:bg-sidebar-ring group-data-[collapsible=icon]:hidden"
    />
  );
}
