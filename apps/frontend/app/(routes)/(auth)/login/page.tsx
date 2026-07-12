"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { LoginForm } from "@/app/components/auth/login-form";
import { InstanceBox } from "@/app/components/native/instance-box";
import { useTranslation } from "@/app/i18n/context";
import { safeInternalPath } from "@/app/lib/auth/redirect";

function LoginPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  // Only honour same-origin relative paths — never an attacker-supplied
  // absolute/protocol-relative URL (open-redirect guard).
  const redirect = safeInternalPath(searchParams.get("redirect"));
  const expired = searchParams.get("expired") === "1";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t("auth.page.login.title")}</CardTitle>
            <CardDescription>{t("auth.page.login.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirect} expired={expired} />
            <div className="mt-4 text-center text-sm">
              {t("auth.page.login.noAccount")}{" "}
              <Link href="/register" className="underline underline-offset-4">
                {t("auth.signUp")}
              </Link>
            </div>
            <div className="mt-2 border-t pt-3 text-center text-sm">
              <Link href="/join" className="font-medium underline underline-offset-4">
                {t("auth.joinByCode")}
              </Link>
            </div>
          </CardContent>
        </Card>
        {/* Self-host server switcher — native app only. */}
        <InstanceBox />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
