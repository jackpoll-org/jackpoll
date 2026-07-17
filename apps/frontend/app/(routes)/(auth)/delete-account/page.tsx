"use client";

import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { DeleteFlowForm } from "@/app/components/auth/delete-flow-form";
import { useTranslation } from "@/app/i18n/context";

export default function DeleteAccountPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.deleteAccountPublic.title")}</CardTitle>
          <CardDescription>{t("auth.deleteAccountPublic.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <DeleteFlowForm mode="account" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
