"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Switch } from "@/app/components/ui/switch";
import { OutcomesEditor } from "./outcomes-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useBuilder } from "./builder-context";
import { useTranslation } from "@/app/i18n/context";
import { BrandingCard } from "./branding-card";
import { ProtectionCard } from "./protection-card";
import { RetentionCard } from "./retention-card";
import { RespondentPrivacyCard } from "./respondent-privacy-card";
import { NotificationsCard } from "./notifications-card";
import { IntegrationsCard } from "./integrations-card";
import { TranslationsCard } from "./translations-card";

type ShowAnswers = "immediately" | "after-submission" | "never";

/** ISO instant → value for <input type="datetime-local"> in local time. */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Survey-level settings: confirmation (#9), quiz (#10) and availability. */
export function BuilderSettings() {
  const { t } = useTranslation();
  const { survey, updateSettings } = useBuilder();
  const settings = survey.settings;

  return (
    <div className="grid gap-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.settings.liveResults")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="live-results"
            checked={settings.showLiveResults}
            onCheckedChange={(c) => updateSettings({ showLiveResults: c })}
          />
          <Label htmlFor="live-results" className="font-normal">
            {t("builder.settings.liveResultsToggle")}
          </Label>
        </div>
        {settings.showLiveResults && (
          <div className="flex items-center gap-2">
            <Switch
              id="post-submit-summary"
              checked={settings.postSubmitSummary}
              onCheckedChange={(c) => updateSettings({ postSubmitSummary: c })}
            />
            <Label htmlFor="post-submit-summary" className="font-normal">
              {t("builder.settings.postSubmitSummary")}
            </Label>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.liveResultsHelp")}
        </p>

        <div className="flex items-center gap-2 border-t pt-3">
          <Switch
            id="live-mode"
            checked={settings.liveMode ?? false}
            onCheckedChange={(c) =>
              // Live mode drives everyone through questions together; it needs
              // live results on to show each question's answers as they arrive.
              updateSettings({ liveMode: c, ...(c ? { showLiveResults: true } : {}) })
            }
          />
          <Label htmlFor="live-mode" className="font-normal">
            {t("builder.settings.liveMode")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.liveModeHelp")}
        </p>

        {settings.liveMode && settings.isQuiz && (
          <div className="grid gap-1.5 sm:max-w-[16rem]">
            <Label htmlFor="live-seconds" className="text-xs">
              {t("builder.settings.liveSeconds")}
            </Label>
            <Input
              id="live-seconds"
              type="number"
              min={0}
              max={300}
              value={settings.liveQuestionSeconds ?? 20}
              onChange={(e) =>
                updateSettings({
                  liveQuestionSeconds: Math.max(0, Math.min(300, Number(e.target.value) || 0)),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("builder.settings.liveSecondsHelp")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.settings.availability")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Label htmlFor="opens-at">{t("builder.settings.opensAt")}</Label>
        <Input
          id="opens-at"
          type="datetime-local"
          className="w-64"
          value={toLocalInput(settings.opensAt)}
          onChange={(e) =>
            updateSettings({
              opensAt: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.opensAtHelp")}
        </p>

        <Label htmlFor="closes-at" className="mt-2">
          {t("builder.settings.closesAt")}
        </Label>
        <Input
          id="closes-at"
          type="datetime-local"
          className="w-64"
          value={toLocalInput(settings.closesAt)}
          onChange={(e) =>
            updateSettings({
              closesAt: e.target.value
                ? new Date(e.target.value).toISOString()
                : undefined,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.closesAtHelp")}
        </p>
        {settings.opensAt &&
          settings.closesAt &&
          new Date(settings.opensAt) >= new Date(settings.closesAt) && (
            <p className="text-xs text-destructive">
              {t("builder.settings.openBeforeClose")}
            </p>
          )}

        <Label htmlFor="response-limit" className="mt-2">
          {t("builder.settings.maxResponses")}
        </Label>
        <Input
          id="response-limit"
          type="number"
          min={0}
          className="w-64"
          value={settings.responseLimit ?? ""}
          onChange={(e) =>
            updateSettings({
              responseLimit: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder={t("builder.settings.unlimited")}
        />
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.maxResponsesHelp")}
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.settings.quizMode")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="is-quiz"
            checked={settings.isQuiz}
            onCheckedChange={(c) => updateSettings({ isQuiz: c })}
          />
          <Label htmlFor="is-quiz" className="font-normal">
            {t("builder.settings.quizToggle")}
          </Label>
        </div>

        {settings.isQuiz && (
          <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <Label htmlFor="time-limit" className="text-xs">
                {t("builder.settings.timeLimit")}
              </Label>
              <Input
                id="time-limit"
                type="number"
                min={0}
                value={settings.timeLimit ? Math.round(settings.timeLimit / 60) : ""}
                onChange={(e) =>
                  updateSettings({
                    timeLimit: e.target.value
                      ? Number(e.target.value) * 60
                      : undefined,
                  })
                }
                placeholder={t("builder.settings.noLimit")}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="passing-score" className="text-xs">
                {t("builder.settings.passingScore")}
              </Label>
              <Input
                id="passing-score"
                type="number"
                min={0}
                value={settings.passingScore ?? ""}
                onChange={(e) =>
                  updateSettings({
                    passingScore: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder={t("builder.settings.none")}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="show-answers" className="text-xs">
                {t("builder.settings.showAnswers")}
              </Label>
              <Select
                value={settings.showCorrectAnswers ?? "after-submission"}
                onValueChange={(v) =>
                  updateSettings({ showCorrectAnswers: v as ShowAnswers })
                }
              >
                <SelectTrigger id="show-answers">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="after-submission">{t("builder.settings.showAnswersAfter")}</SelectItem>
                  <SelectItem value="never">{t("builder.settings.showAnswersNever")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <OutcomesEditor
            outcomes={settings.outcomes ?? []}
            onChange={(o) => updateSettings({ outcomes: o })}
          />
          </>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.settings.afterSubmissionTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="confirmation-message">{t("builder.settings.confirmationMessage")}</Label>
          <Textarea
            id="confirmation-message"
            value={settings.confirmationMessage ?? ""}
            onChange={(e) =>
              updateSettings({ confirmationMessage: e.target.value })
            }
            placeholder={t("builder.settings.confirmationPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">
            {t("builder.settings.confirmationHelp")}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="redirect-url">{t("builder.settings.redirectUrl")}</Label>
          <Input
            id="redirect-url"
            type="url"
            value={settings.redirectUrl ?? ""}
            onChange={(e) => updateSettings({ redirectUrl: e.target.value })}
            placeholder="https://example.com/thank-you"
          />
          <p className="text-xs text-muted-foreground">
            {t("builder.settings.redirectHelp")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-0.5">
            <Label htmlFor="allow-edit-responses">{t("builder.settings.allowEdit")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("builder.settings.allowEditHelp")}
            </p>
          </div>
          <Switch
            id="allow-edit-responses"
            checked={settings.allowEditResponses ?? false}
            onCheckedChange={(c) => updateSettings({ allowEditResponses: c })}
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("builder.settings.presentation")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="conversational"
            checked={settings.conversational ?? false}
            onCheckedChange={(c) => updateSettings({ conversational: c })}
          />
          <Label htmlFor="conversational" className="font-normal">
            {t("builder.settings.conversational")}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("builder.settings.conversationalHelp")}
        </p>
      </CardContent>
    </Card>

    <BrandingCard />
    <RespondentPrivacyCard />
    <NotificationsCard />
    <ProtectionCard />
    <RetentionCard />
    <IntegrationsCard />
    {/* Own translations last — advanced, rarely edited. */}
    <TranslationsCard />
    </div>
  );
}
