"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import { Textarea } from "@/app/components/ui/textarea";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";

/**
 * Respondent privacy notice & legal basis (issue #63, GDPR Art. 13). Lets the
 * owner show their own privacy/contact text on the public survey and require a
 * consent checkbox before submitting.
 */
export function RespondentPrivacyCard() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.privacy.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          {t("builder.privacy.help")}
        </p>

        <div className="grid gap-2">
          <Label htmlFor="privacy-notice">{t("builder.privacy.noticeLabel")}</Label>
          <Textarea
            id="privacy-notice"
            value={settings.privacyNotice ?? ""}
            onChange={(e) => updateSettings({ privacyNotice: e.target.value })}
            placeholder={t("builder.privacy.noticePlaceholder")}
            rows={4}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <Label htmlFor="require-consent" className="font-normal">
              {t("builder.privacy.requireConsent")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("builder.privacy.requireConsentHelp")}
            </p>
          </div>
          <Switch
            id="require-consent"
            checked={settings.requireConsent ?? false}
            onCheckedChange={(c) => updateSettings({ requireConsent: c })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <Label htmlFor="require-name" className="font-normal">
              {t("builder.privacy.requireName")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("builder.privacy.requireNameHelp")}
            </p>
          </div>
          <Switch
            id="require-name"
            checked={settings.requireRespondentName ?? false}
            onCheckedChange={(c) => updateSettings({ requireRespondentName: c })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
