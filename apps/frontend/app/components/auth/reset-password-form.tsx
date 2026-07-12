"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Spinner } from "@/app/components/ui/spinner";
import { cn } from "@/lib/utils";

import { resetPasswordSchema, type ResetPasswordFormData } from "@/app/lib/auth/schemas";
import { useResetPassword } from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";

export function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const resetPassword = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const schema = useMemo(() => resetPasswordSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      await resetPassword.mutateAsync({
        email,
        code: data.code,
        newPassword: data.newPassword,
      });
    } catch {
      // Error handled via resetPassword.error
    }
  };

  // No email in the URL — the user landed here without requesting a reset.
  if (!email) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <LockIcon className="size-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">{t("auth.reset.invalidTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.reset.invalidBody")}
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="mt-2">
            {t("auth.reset.requestNew")}
          </Button>
        </Link>
      </div>
    );
  }

  // Success state
  if (resetPassword.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <LockIcon className="size-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t("auth.reset.doneTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.reset.doneBody")}
        </p>
        <Button className="mt-2" onClick={() => router.replace("/login")}>
          {t("auth.reset.signInNew")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {resetPassword.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {resetPassword.error instanceof Error
              ? resetPassword.error.message
              : t("auth.reset.failed")}
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {t("auth.reset.instruction", { email })}
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rp-code">{t("auth.reset.codeLabel")}</Label>
        <Input
          id="rp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          disabled={resetPassword.isPending}
          {...register("code")}
          className={cn(
            "text-center text-lg tracking-[0.4em]",
            errors.code && "border-destructive",
          )}
        />
        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rp-password">{t("auth.reset.newPassword")}</Label>
        <div className="relative">
          <Input
            id="rp-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={resetPassword.isPending}
            {...register("newPassword")}
            className={cn("pr-10", errors.newPassword && "border-destructive")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rp-confirm-password">{t("auth.reset.confirmNew")}</Label>
        <div className="relative">
          <Input
            id="rp-confirm-password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={resetPassword.isPending}
            {...register("confirmPassword")}
            className={cn("pr-10", errors.confirmPassword && "border-destructive")}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
          >
            {showConfirm ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" disabled={resetPassword.isPending} className="w-full">
        {resetPassword.isPending ? (
          <>
            <Spinner className="size-4" />
            {t("auth.reset.submitting")}
          </>
        ) : (
          t("auth.reset.submit")
        )}
      </Button>
    </form>
  );
}
