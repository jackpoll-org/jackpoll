import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import {
  useLogin,
  useRegister,
  useLogout,
  useCurrentUser,
  useHasToken,
  useForgotPassword,
  useResetPassword,
} from "@/app/hooks/auth";
import { storeAuth, clearAuth } from "@/app/lib/auth/storage";
import { AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";

// ── Wrapper with QueryClient ──────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

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

function successResponse(data: unknown) {
  return { success: true, data };
}

// ── useHasToken (reactivity) ──────────────────────────────────────

describe("useHasToken", () => {
  it("flips false→true when a token is written same-tab (biometric restore)", async () => {
    const { result } = renderHook(() => useHasToken());
    expect(result.current).toBe(false);

    act(() => {
      storeAuth("jwt-restored", { id: "1" });
    });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("flips back to false when the token is cleared", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "existing");
    const { result } = renderHook(() => useHasToken());
    expect(result.current).toBe(true);

    act(() => {
      clearAuth();
    });
    await waitFor(() => expect(result.current).toBe(false));
  });
});

// ── useLogin ──────────────────────────────────────────────────────

describe("useLogin", () => {
  it("persists token and user on success", async () => {
    mockFetch(200, successResponse({
      user: { id: "1", email: "test@test.com", name: "Test", emailVerified: true, createdAt: "2024-01-01T00:00:00Z" },
      tokens: { accessToken: "jwt-token-123", expiresIn: 3600 },
    }));

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@test.com",
        password: "Pass1234",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(localStorage.getItem("survey-auth-token")).toBe("jwt-token-123");
    expect(localStorage.getItem("survey-auth-user")).toBeTruthy();

    const storedUser = JSON.parse(localStorage.getItem("survey-auth-user")!);
    expect(storedUser.email).toBe("test@test.com");
  });

  it("sets error state on failed login", async () => {
    mockFetch(401, { success: false, error: "Invalid email or password" });

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          email: "nobody@test.com",
          password: "WrongPass1",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

// ── useRegister ───────────────────────────────────────────────────

describe("useRegister", () => {
  it("returns the email for verification and does NOT auto-login", async () => {
    mockFetch(200, successResponse({
      email: "john@test.com",
      verificationRequired: true,
    }));

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        name: "John",
        email: "john@test.com",
        password: "SecureP1!",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.data?.verificationRequired).toBe(true);
    // No auto-login: no token/user persisted until the code is verified.
    expect(localStorage.getItem("survey-auth-token")).toBeNull();
  });

  it("errors on duplicate email", async () => {
    mockFetch(409, { success: false, error: "A user with this email already exists" });

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: "Second",
          email: "dup@test.com",
          password: "SecureP1!",
        });
      } catch {
        // expected
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

// ── useLogout ─────────────────────────────────────────────────────

describe("useLogout", () => {
  it("clears localStorage on logout", async () => {
    mockFetch(200, { success: true, data: null });

    // Set up a session
    localStorage.setItem("survey-auth-token", "test-token");
    localStorage.setItem("survey-auth-user", JSON.stringify({ id: "1" }));

    const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(localStorage.getItem("survey-auth-token")).toBeNull();
    expect(localStorage.getItem("survey-auth-user")).toBeNull();
  });
});

// ── useCurrentUser ────────────────────────────────────────────────

describe("useCurrentUser", () => {
  it("does not fetch when no token is stored", () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches user when token is stored", async () => {
    localStorage.setItem("survey-auth-token", "jwt-token-123");
    mockFetch(200, successResponse({
      user: { id: "1", email: "cached@test.com", name: "Cached User", emailVerified: true, createdAt: "2024-01-01T00:00:00Z" },
    }));

    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.email).toBe("cached@test.com");
  });
});

// ── useForgotPassword ─────────────────────────────────────────────

describe("useForgotPassword", () => {
  it("succeeds for any email", async () => {
    mockFetch(200, { success: true, data: null });

    const { result } = renderHook(() => useForgotPassword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({ email: "test@test.com" });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

// ── useResetPassword ──────────────────────────────────────────────

describe("useResetPassword", () => {
  it("succeeds with a valid code", async () => {
    mockFetch(200, { success: true, data: null });

    const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync({
        email: "test@test.com",
        code: "123456",
        newPassword: "NewPass1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
