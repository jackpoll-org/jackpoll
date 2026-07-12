"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/app/components/ui/input";
import { useBuilder } from "./builder-context";
import { useFieldFocus } from "./use-field-focus";
import type { TextTarget } from "@/app/lib/collab/provider";

// One offscreen canvas shared across inputs for caret x-offset measurement.
let sharedCanvas: HTMLCanvasElement | null = null;
function measureWidth(font: string, text: string): number {
  if (typeof document === "undefined") return 0;
  sharedCanvas ??= document.createElement("canvas");
  const ctx = sharedCanvas.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

interface CollabTextInputProps {
  field: "title" | "description";
  questionId?: string;
  sectionId?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

interface Bar {
  clientId: number;
  color: string;
  name: string;
  left: number;
}

/**
 * A single-line text input that shows collaborators' live carets (issue #85).
 * The text itself is merged character-level via the Y.Text binding in doc.ts;
 * this component publishes the local caret and overlays remote ones, measured
 * against the input's own font so they line up with the rendered text.
 */
export function CollabTextInput({
  field,
  questionId,
  sectionId,
  value,
  onChange,
  ...rest
}: CollabTextInputProps) {
  const { setCaret, clearCaret, caretsFor, presence } = useBuilder();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const target = useMemo<TextTarget>(
    () => ({ questionId, sectionId, field }),
    [questionId, sectionId, field],
  );
  const fieldFocus = useFieldFocus(target);
  const [bars, setBars] = useState<Bar[]>([]);
  const [scrollTick, setScrollTick] = useState(0);

  // Remote carets change only when awareness (presence) or the text changes;
  // `presence` and `value` are intentional recompute triggers (caretsFor reads
  // live awareness and resolves positions against the current text).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const carets = useMemo(() => caretsFor(target), [caretsFor, target, presence, value]);

  const input = useCallback(
    () => wrapRef.current?.querySelector("input") ?? null,
    [],
  );

  const pushCaret = useCallback(() => {
    const el = input();
    if (el) setCaret(target, el.selectionStart ?? 0, el.selectionEnd ?? 0);
  }, [input, setCaret, target]);

  useLayoutEffect(() => {
    const el = input();
    if (!el) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBars([]);
      return;
    }
    const cs = getComputedStyle(el);
    const font =
      cs.font && cs.font.trim()
        ? cs.font
        : `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const padLeft = parseFloat(cs.paddingLeft) || 0;
    // Measuring the DOM then writing positions is the legitimate effect use:
    // syncing React state from an external system (rendered text metrics).
    setBars(
      carets.map((c) => {
        const idx = Math.max(0, Math.min(c.head, value.length));
        const w = measureWidth(font, value.slice(0, idx));
        return {
          clientId: c.clientId,
          color: c.color,
          name: c.name,
          left: padLeft + w - el.scrollLeft,
        };
      }),
    );
  }, [carets, value, scrollTick, input]);

  return (
    <span ref={wrapRef} className="relative block">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          pushCaret();
        }}
        onSelect={pushCaret}
        onKeyUp={pushCaret}
        onClick={pushCaret}
        onScroll={() => setScrollTick((t) => t + 1)}
        onFocus={() => {
          fieldFocus.onFocus?.();
          pushCaret();
        }}
        onBlur={() => {
          fieldFocus.onBlur?.();
          clearCaret();
        }}
        {...rest}
      />
      {bars.length > 0 && (
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          {bars.map((b) => (
            <span
              key={b.clientId}
              className="absolute top-1 bottom-1 w-px"
              style={{ left: Math.max(0, b.left), backgroundColor: b.color }}
            >
              <span
                className="absolute left-0 top-0 -translate-y-full whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white"
                style={{ backgroundColor: b.color }}
              >
                {b.name}
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
