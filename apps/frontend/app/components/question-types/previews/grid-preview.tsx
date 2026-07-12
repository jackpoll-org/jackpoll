"use client";

import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import type { Option } from "@/app/types/survey";
import type { QuestionPreviewProps } from "../types";

type GridValue = Record<string, string | string[]>;

/** Preview / answer renderer for grid question types (single or multi per row). */
export function GridPreview({
  question,
  value,
  onChange,
  disabled,
}: QuestionPreviewProps) {
  const rows: Option[] = question.rows ?? [];
  const columns: Option[] = question.columns ?? [];

  if (rows.length === 0 || columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Add at least one row and one column
      </p>
    );
  }

  const multi = question.type === "checkbox-grid";
  const interactive = !!onChange;
  const isDisabled = disabled ?? !interactive;
  const answer: GridValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as GridValue)
      : {};

  function setSingle(rowId: string, colId: string) {
    if (!onChange) return;
    onChange({ ...answer, [rowId]: colId });
  }

  function toggleMulti(rowId: string, colId: string, checked: boolean) {
    if (!onChange) return;
    const current = Array.isArray(answer[rowId]) ? (answer[rowId] as string[]) : [];
    const next = checked
      ? [...current, colId]
      : current.filter((c) => c !== colId);
    onChange({ ...answer, [rowId]: next });
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            {columns.map((col) => (
              <TableHead key={col.id} className="text-center">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowValue = answer[row.id];
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.label}</TableCell>
                {columns.map((col) => (
                  <TableCell key={col.id} className="text-center">
                    {multi ? (
                      <Checkbox
                        disabled={isDisabled}
                        aria-label={`${row.label} – ${col.label}`}
                        checked={
                          Array.isArray(rowValue) && rowValue.includes(col.id)
                        }
                        onCheckedChange={
                          interactive
                            ? (c) => toggleMulti(row.id, col.id, c === true)
                            : undefined
                        }
                      />
                    ) : (
                      <input
                        type="radio"
                        name={`${question.id}-${row.id}`}
                        disabled={isDisabled}
                        aria-label={`${row.label} – ${col.label}`}
                        className="size-4 accent-primary"
                        checked={rowValue === col.id}
                        onChange={
                          interactive ? () => setSingle(row.id, col.id) : undefined
                        }
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
