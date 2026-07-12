"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";

/**
 * Spam & bot protection settings (issue #31). A honeypot and bot heuristics are
 * always on and add no friction; these toggles add stronger, opt-in checks.
 */
export function ProtectionCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("protection.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {t("protection.help")}
        </p>

        <div className="flex items-center gap-2">
          <Switch
            id="rate-limit"
            checked={settings.rateLimit}
            onCheckedChange={(c) => updateSettings({ rateLimit: c })}
          />
          <Label htmlFor="rate-limit" className="font-normal">
            {t("protection.rateLimit")}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="one-per-browser"
            checked={settings.onePerBrowser}
            onCheckedChange={(c) => updateSettings({ onePerBrowser: c })}
          />
          <Label htmlFor="one-per-browser" className="font-normal">
            {t("protection.onePerBrowser")}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="require-captcha"
            checked={settings.requireCaptcha}
            onCheckedChange={(c) => updateSettings({ requireCaptcha: c })}
          />
          <Label htmlFor="require-captcha" className="font-normal">
            {t("protection.captcha")}
          </Label>
        </div>

        <div className="grid gap-1">
          <Label htmlFor="min-submit-seconds" className="text-xs">
            {t("protection.minTime")}
          </Label>
          <Input
            id="min-submit-seconds"
            type="number"
            min={0}
            className="w-48"
            value={settings.minSubmitSeconds ?? ""}
            onChange={(e) =>
              updateSettings({
                minSubmitSeconds: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder={t("protection.off")}
          />
          <p className="text-xs text-muted-foreground">
            {t("protection.minTimeHelp")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
