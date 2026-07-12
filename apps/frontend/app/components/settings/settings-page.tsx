"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { LanguageSwitcher } from "@/app/components/common/language-switcher";
import { AppearanceCard } from "./appearance-card";
import { PushSettingsCard } from "./push-settings-card";
import { NotificationPrefsCard } from "./notification-prefs-card";
import { SurveysCard } from "./surveys-card";
import { DeviceCard } from "./device-card";
import { useTranslation } from "@/app/i18n/context";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-6">
        <AppearanceCard />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.section.language")}</CardTitle>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher fullWidth />
          </CardContent>
        </Card>

        <PushSettingsCard />
        <NotificationPrefsCard />
        <SurveysCard />
        <DeviceCard />
      </div>

    </div>
  );
}
