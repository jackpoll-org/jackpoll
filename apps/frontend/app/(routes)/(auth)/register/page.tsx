"use client";

import { Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { RegisterForm } from "@/app/components/auth/register-form";
import { InstanceBox } from "@/app/components/native/instance-box";
import { useTranslation } from "@/app/i18n/context";
import { useRegistrationEnabled } from "@/app/components/auth/registration-context";

export default function RegisterPage() {
  const { t } = useTranslation();
  const open = useRegistrationEnabled();
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {open ? t("auth.page.register.title") : t("auth.page.register.closedTitle")}
            </CardTitle>
            <CardDescription>
              {open ? t("auth.page.register.desc") : t("auth.page.register.closedDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {open && (
              <Suspense>
                <RegisterForm />
              </Suspense>
            )}
            <div className="mt-4 text-center text-sm">
              {t("auth.page.register.hasAccount")}{" "}
              <Link href="/login" className="underline underline-offset-4">
                {t("auth.signIn")}
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

