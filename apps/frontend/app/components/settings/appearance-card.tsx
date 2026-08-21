"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { PresetSelector } from "@/app/components/theme-customizer/preset-selector";
import { ThemeScaleSelector } from "@/app/components/theme-customizer/scale-selector";
import { ThemeRadiusSelector } from "@/app/components/theme-customizer/radius-selector";
import { ColorModeSelector } from "@/app/components/theme-customizer/color-mode-selector";
import { SettingRow } from "./setting-row";
import { useHideBrand, useReducedMotionPref } from "@/app/lib/preferences/ui-prefs";
import { useTranslation } from "@/app/i18n/context";

export function AppearanceCard() {
  const { t } = useTranslation();
  const [hideBrand, setHideBrand, brandReady] = useHideBrand();
  const [reducedMotion, setReducedMotion] = useReducedMotionPref();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.section.appearance")}</CardTitle>
        <CardDescription>{t("settings.appearance.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <PresetSelector />
          <ColorModeSelector />
          <ThemeRadiusSelector />
          <ThemeScaleSelector />
        </div>

        <SettingRow
          htmlFor="hide-brand"
          title={t("settings.hideBrand.label")}
          description={t("settings.hideBrand.description")}
          control={
            <Switch
              id="hide-brand"
              checked={hideBrand}
              disabled={!brandReady}
              onCheckedChange={setHideBrand}
            />
          }
        />

        <SettingRow
          title={t("settings.reducedMotion.label")}
          description={t("settings.reducedMotion.description")}
          control={
            <Select
              value={reducedMotion}
              onValueChange={(v) =>
                setReducedMotion(v as "system" | "on" | "off")
              }
            >
              <SelectTrigger className="w-40 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("settings.reducedMotion.system")}</SelectItem>
                <SelectItem value="on">{t("settings.reducedMotion.on")}</SelectItem>
                <SelectItem value="off">{t("settings.reducedMotion.off")}</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </CardContent>
    </Card>
  );
}
