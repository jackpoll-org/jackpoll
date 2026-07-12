"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";

/**
 * Data-retention settings (issue #64, GDPR Art. 5(1)(e)). Responses older than
 * the configured number of days are automatically deleted — or anonymised, if
 * enabled — by a daily server job. Off by default (kept indefinitely).
 */
export function RetentionCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;
  const hasRetention = (settings.retentionDays ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.retention.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {t("builder.retention.help")}
        </p>

        <div className="grid gap-1">
          <Label htmlFor="retention-days" className="text-xs">
            {t("builder.retention.daysLabel")}
          </Label>
          <Input
            id="retention-days"
            type="number"
            min={0}
            className="w-48"
            value={settings.retentionDays ?? ""}
            onChange={(e) =>
              updateSettings({
                retentionDays: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder={t("builder.retention.daysPlaceholder")}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <Label htmlFor="retention-anonymize" className="font-normal">
              {t("builder.retention.anonymize")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("builder.retention.anonymizeHelp")}
            </p>
          </div>
          <Switch
            id="retention-anonymize"
            disabled={!hasRetention}
            checked={settings.retentionAnonymize ?? false}
            onCheckedChange={(c) => updateSettings({ retentionAnonymize: c })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
