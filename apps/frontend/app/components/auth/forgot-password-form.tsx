"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon, MailIcon } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Spinner } from "@/app/components/ui/spinner";
import { cn } from "@/lib/utils";

import { forgotPasswordSchema, type ForgotPasswordFormData } from "@/app/lib/auth/schemas";
import { useForgotPassword } from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const forgotPassword = useForgotPassword();

  const schema = useMemo(() => forgotPasswordSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword.mutateAsync(data);
      // Always advance to the code screen (the backend replies 200 regardless of
      // whether the account exists, to avoid email enumeration).
      router.replace(`/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch {
      // Error handled via forgotPassword.error
    }
  };

  if (forgotPassword.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="size-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t("auth.forgot.checkTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.forgot.checkBody")}
        </p>
        <Link href="/login">
          <Button variant="outline" className="mt-2">
            <ArrowLeftIcon className="size-4" />
            {t("auth.backToLogin")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {forgotPassword.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {forgotPassword.error instanceof Error
              ? forgotPassword.error.message
              : t("auth.forgot.failed")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="fp-email">{t("auth.email")}</Label>
        <Input
          id="fp-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={forgotPassword.isPending}
          {...register("email")}
          className={cn(errors.email && "border-destructive")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button type="submit" disabled={forgotPassword.isPending} className="w-full">
        {forgotPassword.isPending ? (
          <>
            <Spinner className="size-4" />
            {t("auth.forgot.submitting")}
          </>
        ) : (
          t("auth.forgot.submit")
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline underline-offset-4">
          <ArrowLeftIcon className="inline size-3" /> {t("auth.backToLogin")}
        </Link>
      </p>
    </form>
  );
}
