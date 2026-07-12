"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Switch } from "@/app/components/ui/switch";
import { SettingRow } from "./setting-row";
import { InstanceBox } from "@/app/components/native/instance-box";
import { useHapticsPref } from "@/app/hooks/use-haptics-pref";
import { useBiometricPref } from "@/app/hooks/use-biometric-pref";
import { useTranslation } from "@/app/i18n/context";

/** Native-only device settings: haptics, biometric unlock, self-host server. */
export function DeviceCard() {
  const { t } = useTranslation();
  const [native, setNative] = useState(false);
  const haptics = useHapticsPref();
  const biometric = useBiometricPref();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNative(Capacitor.isNativePlatform());
  }, []);

  if (!native) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.section.device")}</CardTitle>
        <CardDescription>{t("settings.device.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {haptics.supported && (
          <SettingRow
            htmlFor="haptics-toggle"
            title={t("haptics.setting")}
            control={
              <Switch
                id="haptics-toggle"
                checked={haptics.enabled}
                onCheckedChange={haptics.setEnabled}
              />
            }
          />
        )}
        {biometric.supported && (
          <SettingRow
            htmlFor="biometric-toggle"
            title={t("biometric.setting")}
            control={
              <Switch
                id="biometric-toggle"
                checked={biometric.enabled}
                onCheckedChange={biometric.setEnabled}
              />
            }
          />
        )}
        <InstanceBox />
      </CardContent>
    </Card>
  );
}
