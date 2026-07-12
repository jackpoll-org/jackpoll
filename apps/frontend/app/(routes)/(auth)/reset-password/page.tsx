"use client";

import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { ResetPasswordForm } from "@/app/components/auth/reset-password-form";
import { useTranslation } from "@/app/i18n/context";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.page.reset.title")}</CardTitle>
          <CardDescription>
            {t("auth.page.reset.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
