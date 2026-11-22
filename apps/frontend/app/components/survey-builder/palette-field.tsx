"use client";

import { Palette } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { PaletteDialog, SLOTS } from "@/app/components/survey-results/chart-colors-dialog";
import { useTranslation } from "@/app/i18n/context";

const THEME_COLORS = Array.from({ length: SLOTS }, (_, i) => `var(--chart-${i + 1})`);
const SIZES = ["text-2xl", "text-base", "text-xl", "text-sm", "text-lg"];

export function WordcloudSample({ colors }: { colors: string[] }) {
  const { t } = useTranslation();
  const words = t("builder.palette.sample").split(",");
  return (
    <div
      data-testid="palette-sample"
      aria-hidden
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border p-3 font-bold"
    >
      {words.map((word, i) => (
        <span key={i} className={SIZES[i % SIZES.length]} style={{ color: colors[i % colors.length] }}>
          {word}
        </span>
      ))}
    </div>
  );
}

interface PaletteFieldProps {
  label: string;
  title: string;
  help: string;
  palette: string[] | null;
  resetLabel: string;
  resetMessage: string;
  onSave: (palette: string[] | null) => void;
}

export function PaletteField({ label, title, help, palette, resetLabel, resetMessage, onSave }: PaletteFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">{label}</span>
        <PaletteDialog
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Palette className="size-4" />
              {t("builder.palette.customize")}
            </Button>
          }
          title={title}
          help={help}
          palette={palette}
          resetLabel={resetLabel}
          savedMessage={t("builder.palette.applied")}
          resetMessage={resetMessage}
          onSave={async (next) => onSave(next)}
          preview={(colors) => <WordcloudSample colors={colors} />}
        />
      </div>
      <WordcloudSample colors={palette ?? THEME_COLORS} />
    </div>
  );
}
