/**
 * Auth API service — communicates with the Quarkus backend at {@code API_BASE_URL}.
 */

import { API_BASE_URL, AUTH_ENDPOINTS } from "./constants";
import { getCookie } from "@/app/lib/cookies";
import { LOCALE_COOKIE } from "@/app/i18n/context";
import { getStoredToken } from "./storage";
import { refreshAccessToken } from "./refresh";
import type {
  ApiResponse,
  AuthResponseData,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResult,
  ResetPasswordRequest,
  User,
} from "@/app/types/auth";

// ── Generic fetch helper ──────────────────────────────────────────

/** Credential endpoints must never trigger a refresh retry (avoids loops). */
function refreshable(endpoint: string): boolean {
  return !/^\/auth\/(refresh|login|register|forgot-password|reset-password|verify-email|resend-verification|delete-account|delete-data)/.test(
    endpoint,
  );
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    // The language chosen in the app decides which language the backend writes
    // this account's emails in (verification codes, notifications). Sent on every
    // auth call, so switching the app language switches the emails too.
    const locale = getCookie(LOCALE_COOKIE);
    if (locale) headers["Accept-Language"] = locale;
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  };

  const hadToken = !!getStoredToken();
  let res = await fetch(url, {
    ...options,
    headers: buildHeaders(),
    credentials: "include",
  });

  // Access token expired → silently refresh (single-flight) and retry once.
  // Only for logged-in callers and non-credential endpoints (issue #35).
  if (res.status === 401 && hadToken && refreshable(endpoint)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(),
        credentials: "include",
      });
    }
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? `Request failed with status ${res.status}`);
  }

  return body as ApiResponse<T>;
}

// ── Auth API ──────────────────────────────────────────────────────

export async function loginApi(
  data: LoginRequest,
  offline = false,
): Promise<ApiResponse<AuthResponseData>> {
  return request<AuthResponseData>(AUTH_ENDPOINTS.login, {
    method: "POST",
    body: JSON.stringify(data),
    // Native clients ask for a long-lived offline token (returned in the body)
    // so they can restore the session later behind a biometric prompt.
    ...(offline ? { headers: { "X-Auth-Offline": "true" } } : {}),
  });
}

export async function registerApi(data: RegisterRequest): Promise<ApiResponse<RegisterResult>> {
  // No tokens on register: the account is unverified until the emailed code is
  // confirmed. Returns { email, verificationRequired } so the UI can route to
  // the verification screen (#security email-verify).
  return request<RegisterResult>(AUTH_ENDPOINTS.register, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logoutApi(offlineToken?: string | null): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.logout, {
    method: "POST",
    // Native clients have no refresh cookie; pass the stored offline token so
    // the backend can revoke it server-side.
    ...(offlineToken ? { headers: { "X-Refresh-Token": offlineToken } } : {}),
  });
}

/**
 * Log out of every device — revokes all of the user's Keycloak sessions
 * (refresh + offline tokens) server-side (#76). Requires a valid access token.
 */
export async function logoutAllApi(): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.logoutAll, { method: "POST" });
}

export async function getCurrentUserApi(): Promise<ApiResponse<{ user: User }>> {
  return request<{ user: User }>(AUTH_ENDPOINTS.me);
}

export async function updateProfileApi(
  name: string,
): Promise<ApiResponse<{ user: User }>> {
  return request<{ user: User }>(AUTH_ENDPOINTS.profile, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.changePassword, {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** GDPR erasure (Art. 17) — delete the account and all its data. */
export async function deleteAccountApi(): Promise<ApiResponse<null>> {
  return request<null>("/me", { method: "DELETE" });
}

/** GDPR access/portability (Art. 15/20) — download all of the user's data as JSON. */
export async function downloadMyDataExport(): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE_URL}/me/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Could not export your data. Please try again.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "survey-school-data.json";
  link.click();
  URL.revokeObjectURL(url);
}

export async function verifyEmailApi(
  email: string,
  code: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.verifyEmail, {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function resendVerificationApi(email: string): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.resendVerification, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function forgotPasswordApi(data: ForgotPasswordRequest): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.forgotPassword, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resetPasswordApi(data: ResetPasswordRequest): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Public account/data deletion (no login required) ───────────────

export async function requestAccountDeletionApi(
  email: string,
  password: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.deleteAccountRequest, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function confirmAccountDeletionApi(
  email: string,
  code: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.deleteAccountConfirm, {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function requestDataDeletionApi(
  email: string,
  password: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.deleteDataRequest, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function confirmDataDeletionApi(
  email: string,
  code: string,
): Promise<ApiResponse<null>> {
  return request<null>(AUTH_ENDPOINTS.deleteDataConfirm, {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

