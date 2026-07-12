"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

import { loginSchema, type LoginFormData } from "@/app/lib/auth/schemas";
import { useLogin } from "@/app/hooks/auth";
import { useTranslation } from "@/app/i18n/context";

interface LoginFormProps {
  redirectTo?: string;
  /** Show a "session expired" notice (after a failed silent refresh, #35). */
  expired?: boolean;
}

export function LoginForm({ redirectTo, expired }: LoginFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => loginSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login.mutateAsync(data);
      router.replace(redirectTo ?? "/");
    } catch (e) {
      // Valid credentials but an unverified email → the backend returns 403
      // with this marker (a fresh code was just sent). Route to verification
      // instead of showing an error (#security email-verify).
      if (e instanceof Error && e.message === "EMAIL_NOT_VERIFIED") {
        router.replace(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      // Any other error is surfaced via login.error.
    }
  };

  return (
    <div className="grid gap-4">
      {expired && !login.error && (
        <Alert>
          <AlertDescription>
            {t("auth.login.expired")}
          </AlertDescription>
        </Alert>
      )}

      {login.error &&
        !(login.error instanceof Error && login.error.message === "EMAIL_NOT_VERIFIED") && (
        <Alert variant="destructive">
          <AlertDescription>
            {login.error instanceof Error ? login.error.message : t("auth.login.failed")}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{t("auth.email")}</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="contact@example.com"
            disabled={login.isPending}
            {...register("email")}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="login-password">{t("auth.password")}</Label>
            <Link
              href="/forgot-password"
              className="ml-auto inline-block text-sm underline"
            >
              {t("auth.login.forgot")}
            </Link>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              disabled={login.isPending}
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

        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? (
            <>
              <Spinner className="size-4" />
              {t("auth.login.submitting")}
            </>
          ) : (
            t("auth.login.submit")
          )}
        </Button>
      </form>
    </div>
  );
}
