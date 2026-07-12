import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loginApi,
  registerApi,
  logoutApi,
  logoutAllApi,
  getCurrentUserApi,
  verifyEmailApi,
  forgotPasswordApi,
  resetPasswordApi,
} from "@/app/lib/auth/api";

// ── fetch mock ────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function mockFetch(status: number, body: unknown) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// ── Login API ─────────────────────────────────────────────────────

describe("loginApi", () => {
  it("returns success with correct credentials", async () => {
    mockFetch(200, {
      success: true,
      data: {
        user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true, createdAt: "2024-01-01T00:00:00Z" },
        tokens: { accessToken: "jwt-token-123", expiresIn: 3600 },
      },
    });

    const result = await loginApi({ email: "test@test.com", password: "Pass1234" });

    expect(result.success).toBe(true);
    expect(result.data?.user.email).toBe("test@test.com");
    expect(result.data?.tokens.accessToken).toBe("jwt-token-123");
  });

  it("throws on invalid credentials", async () => {
    mockFetch(401, { success: false, error: "Invalid email or password" });

    await expect(
      loginApi({ email: "test@test.com", password: "Wrong" })
    ).rejects.toThrow("Invalid");
  });
});

// ── Register API ──────────────────────────────────────────────────

describe("registerApi", () => {
  it("creates an unverified account and returns the email (no tokens)", async () => {
    mockFetch(200, {
      success: true,
      data: { email: "jane@example.com", verificationRequired: true },
    });

    const result = await registerApi({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "SecurePass1",
    });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("jane@example.com");
    expect(result.data?.verificationRequired).toBe(true);
  });

  it("throws on duplicate email", async () => {
    mockFetch(409, { success: false, error: "A user with this email already exists" });

    await expect(
      registerApi({ name: "Jane", email: "dup@example.com", password: "SecurePass1" })
    ).rejects.toThrow("already exists");
  });
});

// ── Logout API ────────────────────────────────────────────────────

describe("logoutApi", () => {
  it("returns success", async () => {
    mockFetch(200, { success: true, data: null });

    const result = await logoutApi();
    expect(result.success).toBe(true);
  });
});

// ── Logout-all API (#76) ──────────────────────────────────────────

describe("logoutAllApi", () => {
  it("POSTs to the logout-all endpoint and returns success", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: null }),
    } as Response);

    const result = await logoutAllApi();

    expect(result.success).toBe(true);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain("/auth/logout-all");
    expect(init?.method).toBe("POST");
  });

  it("throws when not authenticated", async () => {
    mockFetch(401, { success: false, error: "Not authenticated" });

    await expect(logoutAllApi()).rejects.toThrow("Not authenticated");
  });
});

// ── Get Current User API ──────────────────────────────────────────

describe("getCurrentUserApi", () => {
  it("throws when not authenticated", async () => {
    mockFetch(401, { success: false, error: "Not authenticated" });

    await expect(getCurrentUserApi()).rejects.toThrow("Not authenticated");
  });

  it("returns user when authenticated", async () => {
    localStorage.setItem("survey-auth-token", "jwt-token-123");
    mockFetch(200, {
      success: true,
      data: {
        user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true, createdAt: "2024-01-01T00:00:00Z" },
      },
    });

    const result = await getCurrentUserApi();
    expect(result.success).toBe(true);
    expect(result.data?.user.email).toBe("test@test.com");
  });
});

// ── Verify Email API ──────────────────────────────────────────────

describe("verifyEmailApi", () => {
  it("verifies email with a code successfully", async () => {
    mockFetch(200, { success: true, data: null });

    const result = await verifyEmailApi("jane@example.com", "123456");
    expect(result.success).toBe(true);
  });

  it("throws on invalid code", async () => {
    mockFetch(400, { success: false, error: "Invalid or expired code. Please try again." });

    await expect(verifyEmailApi("jane@example.com", "000000")).rejects.toThrow("Invalid");
  });
});

// ── Forgot Password API ───────────────────────────────────────────

describe("forgotPasswordApi", () => {
  it("returns success for any email (no enumeration)", async () => {
    mockFetch(200, { success: true, data: null });

    const result = await forgotPasswordApi({ email: "test@example.com" });
    expect(result.success).toBe(true);
  });
});

// ── Reset Password API ────────────────────────────────────────────

describe("resetPasswordApi", () => {
  it("resets password with a code successfully", async () => {
    mockFetch(200, { success: true, data: null });

    const result = await resetPasswordApi({
      email: "jane@example.com",
      code: "123456",
      newPassword: "NewPass1",
    });
    expect(result.success).toBe(true);
  });

  it("throws on invalid code", async () => {
    mockFetch(400, { success: false, error: "Invalid or expired code. Please try again." });

    await expect(
      resetPasswordApi({ email: "jane@example.com", code: "000000", newPassword: "NewPass1" })
    ).rejects.toThrow("Invalid");
  });
});
