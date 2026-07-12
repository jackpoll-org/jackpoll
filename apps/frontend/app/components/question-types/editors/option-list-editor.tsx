"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { Option } from "@/app/types/survey";
import {
  createOption,
  removeOption,
  updateOptionCapacity,
  updateOptionLabel,
} from "../helpers";
import { useTranslation } from "@/app/i18n/context";

interface OptionListEditorProps {
  label: string;
  options: Option[];
  onChange: (options: Option[]) => void;
  addLabel?: string;
  /** Default label prefix for newly added items (e.g. "Option", "Row"). */
  itemNoun?: string;
  /** Show a per-option quota input (single-select choices, #38). */
  showCapacity?: boolean;
}

/**
 * Reusable editor for an ordered list of labelled options. Used for choice
 * options as well as grid rows and columns.
 */
export function OptionListEditor({
  label,
  options,
  onChange,
  addLabel,
  itemNoun,
  showCapacity = false,
}: OptionListEditorProps) {
  const { t } = useTranslation();
  const noun = itemNoun ?? t("qedit.noun.option");
  const addText = addLabel ?? t("qedit.addOption");
  function handleAdd() {
    onChange([...options, createOption(`${noun} ${options.length + 1}`)]);
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          <Input
            value={option.label}
            onChange={(e) => onChange(updateOptionLabel(options, option.id, e.target.value))}
            placeholder={t("qedit.optionLabel", { noun })}
          />
          {showCapacity && (
            <Input
              type="number"
              min={0}
              className="w-24"
              value={option.capacity ?? ""}
              placeholder={t("qedit.limit")}
              aria-label={t("qedit.capacityFor", { label: option.label || noun })}
              onChange={(e) =>
                onChange(
                  updateOptionCapacity(
                    options,
                    option.id,
                    e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                  ),
                )
              }
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("qedit.removeItem", { label: option.label || noun })}
            onClick={() => onChange(removeOption(options, option.id))}
            disabled={options.length <= 1}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="size-4" />
          {addText}
        </Button>
      </div>
    </div>
  );
}
