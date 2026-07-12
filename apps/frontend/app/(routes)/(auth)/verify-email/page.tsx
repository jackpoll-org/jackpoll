"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MailCheckIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Spinner } from "@/app/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { cn } from "@/lib/utils";

import { useVerifyEmail, useResendVerification } from "@/app/hooks/auth";
import { verifyEmailSchema, type VerifyEmailFormData } from "@/app/lib/auth/schemas";
import { useTranslation } from "@/app/i18n/context";

function VerifyEmailContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const verifyEmail = useVerifyEmail();
  const resend = useResendVerification();
  const [resent, setResent] = useState(false);

  const schema = useMemo(() => verifyEmailSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (data: VerifyEmailFormData) => {
    try {
      await verifyEmail.mutateAsync({ email, code: data.code });
    } catch {
      // Surfaced via verifyEmail.error
    }
  };

  const onResend = async () => {
    try {
      await resend.mutateAsync(email);
      setResent(true);
    } catch {
      // Best-effort; ignore
    }
  };

  // Success — the account is verified; send the user to sign in.
  if (verifyEmail.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheckIcon className="size-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t("auth.verify.successTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.verify.successBody")}</p>
        <Link href="/login">
          <Button className="mt-2">
            {t("auth.verify.continue")}
            <ArrowRightIcon className="size-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {email
          ? t("auth.verify.instruction", { email })
          : t("auth.verify.instructionNoEmail")}
      </p>

      {verifyEmail.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {verifyEmail.error instanceof Error
              ? verifyEmail.error.message
              : t("auth.verify.failedBody")}
          </AlertDescription>
        </Alert>
      )}

      {resent && !verifyEmail.error && (
        <Alert>
          <AlertDescription>{t("auth.verify.resent")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2">
        <Label htmlFor="verify-code">{t("auth.verify.codeLabel")}</Label>
        <Input
          id="verify-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          disabled={verifyEmail.isPending}
          {...register("code")}
          className={cn(
            "text-center text-lg tracking-[0.4em]",
            errors.code && "border-destructive",
          )}
        />
        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
      </div>

      <Button type="submit" disabled={verifyEmail.isPending} className="w-full">
        {verifyEmail.isPending ? (
          <>
            <Spinner className="size-4" />
            {t("auth.verify.submitting")}
          </>
        ) : (
          t("auth.verify.submit")
        )}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={onResend}
          disabled={resend.isPending || !email}
          className="underline underline-offset-4 disabled:opacity-50"
        >
          {resend.isPending ? t("auth.verify.resending") : t("auth.verify.resend")}
        </button>
      </div>

      <div className="text-center text-sm">
        <Link href="/login" className="underline underline-offset-4">
          {t("auth.backToLogin")}
        </Link>
      </div>
    </form>
  );
}

function VerifyEmailFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Spinner className="size-8 text-primary" />
      <h2 className="text-xl font-semibold">{t("auth.verify.verifying")}</h2>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.page.verify.title")}</CardTitle>
          <CardDescription>{t("auth.page.verify.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<VerifyEmailFallback />}>
            <VerifyEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
