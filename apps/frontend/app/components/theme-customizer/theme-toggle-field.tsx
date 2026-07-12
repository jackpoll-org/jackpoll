"use client";

import type { ReactNode } from "react";
import { Label } from "@/app/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/app/components/ui/toggle-group";

export interface ToggleOption<T extends string> {
  value: T;
  /** Visible content — a short label or an icon. */
  content: ReactNode;
}

interface ThemeToggleFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<ToggleOption<T>>;
  onChange: (value: T) => void;
}

/**
 * Labeled single-select toggle row used by every theme setting (radius, scale,
 * color mode). Ignores the empty string the ToggleGroup emits when the active
 * item is re-clicked so a setting can never be cleared to an invalid value.
 */
export function ThemeToggleField<T extends string>({
  label,
  value,
  options,
  onChange,
}: ThemeToggleFieldProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      <Label>{label}</Label>
      <ToggleGroup
        type="single"
        className="w-full"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as T);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            variant="outline"
            className="grow"
          >
            {option.content}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
