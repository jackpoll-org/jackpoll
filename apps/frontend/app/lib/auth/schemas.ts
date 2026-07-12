import { z } from "zod/v4";
import { MIN_PASSWORD_LENGTH } from "./constants";
import type { TranslateFn } from "@/app/i18n/context";

// ── Auth Zod schemas ──────────────────────────────────────────────
//
// Schemas are factories taking the translation function so validation
// messages are localized (issue #93). The exported types are inferred from a
// representative instance (the shape is identical regardless of locale).

export function loginSchema(t: TranslateFn) {
  return z.object({
    email: z
      .string()
      .min(1, t("auth.validation.emailRequired"))
      .email(t("auth.validation.emailInvalid")),
    password: z.string().min(1, t("auth.validation.passwordRequired")),
  });
}

function passwordRules(t: TranslateFn) {
  return z
    .string()
    .min(MIN_PASSWORD_LENGTH, t("auth.validation.passwordMin", { n: String(MIN_PASSWORD_LENGTH) }))
    .regex(/[A-Z]/, t("auth.validation.passwordUpper"))
    .regex(/[a-z]/, t("auth.validation.passwordLower"))
    .regex(/[0-9]/, t("auth.validation.passwordNumber"));
}

export function registerSchema(t: TranslateFn) {
  return z
    .object({
      name: z
        .string()
        .min(1, t("auth.validation.nameRequired"))
        .max(100, t("auth.validation.nameMax")),
      email: z
        .string()
        .min(1, t("auth.validation.emailRequired"))
        .email(t("auth.validation.emailInvalid")),
      password: passwordRules(t),
      confirmPassword: z.string().min(1, t("auth.validation.confirmRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.validation.mismatch"),
      path: ["confirmPassword"],
    });
}

export function forgotPasswordSchema(t: TranslateFn) {
  return z.object({
    email: z
      .string()
      .min(1, t("auth.validation.emailRequired"))
      .email(t("auth.validation.emailInvalid")),
  });
}

/** 6-digit numeric code shared by email verification + password reset. */
function codeRule(t: TranslateFn) {
  return z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, t("auth.validation.codeInvalid"));
}

export function verifyEmailSchema(t: TranslateFn) {
  return z.object({
    code: codeRule(t),
  });
}

export function resetPasswordSchema(t: TranslateFn) {
  return z
    .object({
      code: codeRule(t),
      newPassword: passwordRules(t),
      confirmPassword: z.string().min(1, t("auth.validation.confirmRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.validation.mismatch"),
      path: ["confirmPassword"],
    });
}

// ── Inferred types ────────────────────────────────────────────────

export type LoginFormData = z.infer<ReturnType<typeof loginSchema>>;
export type RegisterFormData = z.infer<ReturnType<typeof registerSchema>>;
export type ForgotPasswordFormData = z.infer<ReturnType<typeof forgotPasswordSchema>>;
export type ResetPasswordFormData = z.infer<ReturnType<typeof resetPasswordSchema>>;
export type VerifyEmailFormData = z.infer<ReturnType<typeof verifyEmailSchema>>;
