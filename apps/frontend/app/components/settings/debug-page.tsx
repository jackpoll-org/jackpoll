"use client";

// Settings → Debug / Diagnostics. Lets a signed-in user verify their own push
// and email delivery. All actions hit authenticated, rate-limited backend
// endpoints and only affect the current user. Visibility is gated by the
// instance's DEBUG_TOOLS_ENABLED flag (checked in the Settings menu).

import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { PushSetup } from "@/app/components/native/push-setup";
import { testPushApi, testEmailApi } from "@/app/lib/survey/api";
import { useTranslation } from "@/app/i18n/context";

export function DebugPage() {
  const { t } = useTranslation();
  const [pushBusy, setPushBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  async function testPush() {
    setPushBusy(true);
    try {
      const res = await testPushApi();
      if (res.data?.sent) toast.success(t("debug.push.sent"));
      else toast.error(t("debug.push.none"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("debug.error"));
    } finally {
      setPushBusy(false);
    }
  }

  async function testEmail() {
    setEmailBusy(true);
    try {
      const res = await testEmailApi();
      if (res.data?.sent) toast.success(t("debug.email.sent"));
      else toast.error(t("debug.email.failed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("debug.error"));
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("debug.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("debug.subtitle")}</p>
      </div>

      <div className="grid gap-6">
        {/* Push status + onboarding (native only; hidden on the web). */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("debug.section.push")}</CardTitle>
            <CardDescription>{t("debug.section.pushDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PushSetup />
            <Button onClick={testPush} disabled={pushBusy}>
              {pushBusy && <Spinner className="size-4" />}
              {t("debug.testPush")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("debug.section.email")}</CardTitle>
            <CardDescription>{t("debug.section.emailDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={testEmail} disabled={emailBusy}>
              {emailBusy && <Spinner className="size-4" />}
              {t("debug.testEmail")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
