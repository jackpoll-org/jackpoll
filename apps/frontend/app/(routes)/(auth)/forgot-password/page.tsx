"use client";

import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { ForgotPasswordForm } from "@/app/components/auth/forgot-password-form";
import { InstanceBox } from "@/app/components/native/instance-box";
import { useTranslation } from "@/app/i18n/context";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("auth.page.forgot.title")}</CardTitle>
            <CardDescription>
              {t("auth.page.forgot.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <ForgotPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
        {/* Self-host server switcher — native app only. */}
        <InstanceBox />
      </div>
    </div>
  );
}
