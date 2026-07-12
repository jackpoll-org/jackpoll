"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";

type OwnerNotify = "off" | "each" | "daily";

/**
 * Email notification settings (issue #24): notify the owner on new responses
 * (each or a daily digest) and offer respondents an optional receipt.
 * Defaults are off so nothing is sent unless explicitly enabled.
 */
export function NotificationsCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;
  const ownerNotify = settings.ownerNotify ?? "off";
  const receipts = settings.respondentReceipts ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.notify.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="owner-notify" className="text-sm">
            {t("builder.notify.ownerLabel")}
          </Label>
          <Select
            value={ownerNotify}
            onValueChange={(v) => updateSettings({ ownerNotify: v as OwnerNotify })}
          >
            <SelectTrigger id="owner-notify" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">{t("builder.notify.off")}</SelectItem>
              <SelectItem value="each">{t("builder.notify.each")}</SelectItem>
              <SelectItem value="daily">{t("builder.notify.daily")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("builder.notify.ownerHelp")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="respondent-receipts"
            checked={receipts}
            onCheckedChange={(c) => updateSettings({ respondentReceipts: c })}
          />
          <Label htmlFor="respondent-receipts" className="font-normal">
            {t("builder.notify.receipts")}
          </Label>
        </div>

        {receipts && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">{t("builder.notify.receiptPreview")}</p>
            <p>
              {t("builder.notify.receiptSubject", {
                title: survey.title || t("builder.untitledSurvey"),
              })}
            </p>
            <p className="mt-1">
              {t("builder.notify.receiptBody", {
                title: survey.title || t("builder.untitledSurvey"),
              })}
              {survey.settings.isQuiz && t("builder.notify.receiptScore")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
