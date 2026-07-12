"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  loginApi,
  registerApi,
  logoutApi,
  logoutAllApi,
  getCurrentUserApi,
  updateProfileApi,
  changePasswordApi,
  deleteAccountApi,
  verifyEmailApi,
  resendVerificationApi,
  forgotPasswordApi,
  resetPasswordApi,
} from "@/app/lib/auth/api";
import { authKeys, AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";
import {
  AUTH_STORAGE_EVENT,
  clearAuth as clearAuthStorage,
  getStoredToken,
  storeAuth as persistAuth,
} from "@/app/lib/auth/storage";
import { useTokenRefresh } from "@/app/hooks/use-token-refresh";
import { biometricSupported, clearBiometricUnlock } from "@/app/lib/native/biometric";
import {
  clearOfflineToken,
  getOfflineToken,
  storeOfflineToken,
} from "@/app/lib/native/secure-session";
import type {
  AuthState,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from "@/app/types/auth";

// ── useHasToken (reactive) ────────────────────────────────────────

/**
 * Reactive presence of the auth token in localStorage. Re-renders when the
 * token is written/cleared (login, logout, biometric restore) so a disabled
 * `/me` query re-enables and refetches — without this the user can unlock with
 * biometrics but never get redirected, because nothing re-reads the token.
 */
function subscribeToken(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // cross-tab login/logout
  return () => {
    window.removeEventListener(AUTH_STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function tokenSnapshot(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem(AUTH_STORAGE_KEY);
}

export function useHasToken(): boolean {
  return useSyncExternalStore(subscribeToken, tokenSnapshot, () => false);
}

// ── useCurrentUser (query) ────────────────────────────────────────

export function useCurrentUser() {
  const hasToken = useHasToken();

  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const res = await getCurrentUserApi();
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Not authenticated");
      }
      return res.data.user;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
    // When the query fails (e.g., token expired), clear stale auth state
    // so the middleware no longer treats the user as authenticated
  });
}

// ── Profile management ────────────────────────────────────────────

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await updateProfileApi(name);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Failed to update profile");
      }
      return res.data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.user(), user);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await changePasswordApi(data.currentPassword, data.newPassword);
      if (!res.success) {
        throw new Error(res.error ?? "Failed to change password");
      }
      return res;
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await deleteAccountApi();
      if (!res.success) {
        throw new Error(res.error ?? "Failed to delete account");
      }
      return res;
    },
    onSuccess: () => {
      clearAuthStorage();
      void clearOfflineToken();
      clearBiometricUnlock();
      queryClient.clear();
    },
  });
}

// ── useAuthState ──────────────────────────────────────────────────

export function useAuthState(): AuthState {
  const { data: user, isLoading, isError } = useCurrentUser();
  const hasToken = useHasToken();

  // Proactively refresh the access token before it expires (issue #35).
  useTokenRefresh(hasToken);

  // If the current-user query failed (e.g., token expired/invalid),
  // clear stale auth state so the middleware no longer thinks the
  // user is authenticated. Without this, the user gets stuck: the
  // middleware lets them through (cookie exists) but RequireAuth
  // redirects them back to login (API says not authenticated).
  useEffect(() => {
    if (isError && hasToken) {
      clearAuthStorage();
    }
  }, [isError, hasToken]);

  // Treat the user as logged out the moment the token is gone (logout) or the
  // /me query failed (expired/revoked). React Query keeps the last successful
  // `data` on error, so without this gate the avatar/name would linger after
  // logout instead of falling back to the Sign in / Sign up buttons.
  const effectiveUser = hasToken && !isError ? (user ?? null) : null;

  return useMemo<AuthState>(
    () => ({
      user: effectiveUser,
      tokens: hasToken ? { accessToken: getStoredToken()!, expiresIn: 3600 } : null,
      isAuthenticated: !!effectiveUser,
      isLoading,
    }),
    [effectiveUser, hasToken, isLoading],
  );
}

// ── useLogin ──────────────────────────────────────────────────────

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    // On native, request an offline token so the session can later be restored
    // with biometrics; the web ignores the flag.
    mutationFn: (data: LoginRequest) => loginApi(data, biometricSupported()),
    onSuccess: (res) => {
      if (res.success && res.data) {
        persistAuth(res.data.tokens.accessToken, res.data.user);
        if (res.data.offlineToken) {
          void storeOfflineToken(res.data.offlineToken);
        }
        queryClient.setQueryData(authKeys.user(), res.data.user);
        queryClient.invalidateQueries({ queryKey: authKeys.all });
      }
    },
  });
}

// ── useRegister ───────────────────────────────────────────────────

export function useRegister() {
  // No auto-login: registration creates an unverified account and emails a
  // code. The form routes to /verify-email using the returned email
  // (#security email-verify).
  return useMutation({
    mutationFn: (data: RegisterRequest) => registerApi(data),
  });
}

// ── useLogout ─────────────────────────────────────────────────────

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Revoke the offline token server-side (native), then drop local state.
      const offlineToken = await getOfflineToken();
      return logoutApi(offlineToken);
    },
    onSettled: () => {
      clearAuthStorage();
      void clearOfflineToken();
      clearBiometricUnlock();
      queryClient.clear();
    },
  });
}

// ── useLogoutAllDevices ───────────────────────────────────────────

/**
 * Log out of every device — revokes all Keycloak sessions server-side (#76),
 * then clears local auth + offline token like a normal logout.
 */
export function useLogoutAllDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => logoutAllApi(),
    onSettled: () => {
      clearAuthStorage();
      void clearOfflineToken();
      clearBiometricUnlock();
      queryClient.clear();
    },
  });
}

// ── useVerifyEmail ────────────────────────────────────────────────

export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyEmailRequest) => verifyEmailApi(data.email, data.code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

// ── useResendVerification ─────────────────────────────────────────

export function useResendVerification() {
  return useMutation({
    mutationFn: (email: string) => resendVerificationApi(email),
  });
}

// ── useForgotPassword ─────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => forgotPasswordApi(data),
  });
}

// ── useResetPassword ──────────────────────────────────────────────

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => resetPasswordApi(data),
  });
}
