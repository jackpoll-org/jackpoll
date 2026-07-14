"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Spinner } from "@/app/components/ui/spinner";
import { cn } from "@/lib/utils";

import { registerSchema, type RegisterFormData } from "@/app/lib/auth/schemas";
import { useRegister } from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";

export function RegisterForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const schema = useMemo(() => registerSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const res = await registerMutation.mutateAsync(data);
      // Instances with email verification disabled (self-host without a mail
      // provider) activate the account immediately — send the user to sign in
      // instead of the "check your email" screen.
      if (res?.data?.verificationRequired === false) {
        router.replace(`/login?registered=1`);
      } else {
        router.replace(`/verify-email?email=${encodeURIComponent(data.email)}`);
      }
    } catch {
      // Error is handled via registerMutation.error
    }
  };

  return (
    <div className="grid gap-4">
      {registerMutation.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {registerMutation.error instanceof Error
              ? registerMutation.error.message
              : t("auth.register.failed")}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="reg-name">{t("auth.name")}</Label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder={t("auth.namePlaceholder")}
            disabled={registerMutation.isPending}
            {...register("name")}
            className={cn(errors.name && "border-destructive")}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reg-email">{t("auth.email")}</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="contact@example.com"
            disabled={registerMutation.isPending}
            {...register("email")}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reg-password">{t("auth.password")}</Label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              disabled={registerMutation.isPending}
              {...register("password")}
              className={cn("pr-10", errors.password && "border-destructive")}
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
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reg-confirm-password">{t("auth.confirmPassword")}</Label>
          <div className="relative">
            <Input
              id="reg-confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              disabled={registerMutation.isPending}
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

        <Button type="submit" disabled={registerMutation.isPending} className="w-full">
          {registerMutation.isPending ? (
            <>
              <Spinner className="size-4" />
              {t("auth.register.submitting")}
            </>
          ) : (
            t("auth.register.submit")
          )}
        </Button>
      </form>
    </div>
  );
}
