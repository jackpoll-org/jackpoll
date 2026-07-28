import { describe, it, expect } from "vitest";
import {
  loginSchema as makeLogin,
  registerSchema as makeRegister,
  forgotPasswordSchema as makeForgot,
  resetPasswordSchema as makeReset,
} from "@/app/lib/auth/schemas";
import type { TranslateFn } from "@/app/i18n/context";

// Schemas are localized factories; in tests we stub t to echo the key.
const t = ((key: string) => key) as TranslateFn;
const loginSchema = makeLogin(t);
const registerSchema = makeRegister(t);
const forgotPasswordSchema = makeForgot(t);
const resetPasswordSchema = makeReset(t);

// ── Login Schema ──────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "secret123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("password");
    }
  });
});

// ── Register Schema ───────────────────────────────────────────────

describe("registerSchema", () => {
  const validData = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "SecurePass1",
    confirmPassword: "SecurePass1",
  };

  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = registerSchema.safeParse({ ...validData, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const data = { ...validData, password: "alllowercase1", confirmPassword: "alllowercase1" };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const data = { ...validData, password: "ALLUPPERCASE1", confirmPassword: "ALLUPPERCASE1" };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const data = { ...validData, password: "NoNumbersHere", confirmPassword: "NoNumbersHere" };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const data = { ...validData, password: "Sh0rt", confirmPassword: "Sh0rt" };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const data = { ...validData, confirmPassword: "Different1" };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(confirmError).toBeDefined();
    }
  });

  it("rejects name longer than 100 characters", () => {
    const data = { ...validData, name: "A".repeat(101) };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// ── Forgot Password Schema ────────────────────────────────────────

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

// ── Reset Password Schema ─────────────────────────────────────────

describe("resetPasswordSchema", () => {
  // The reset flow is code-based: the emailed 6-digit code is part of the form,
  // so a payload without it is (correctly) invalid.
  const validData = {
    code: "123456",
    newPassword: "NewSecure1",
    confirmPassword: "NewSecure1",
  };

  it("accepts valid password data", () => {
    const result = resetPasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const data = { ...validData, confirmPassword: "Different1" };
    const result = resetPasswordSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it("rejects weak password", () => {
    const data = { newPassword: "weak", confirmPassword: "weak" };
    const result = resetPasswordSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
