// ── Auth domain types ──────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

/** Code-based password reset (replaces the old Keycloak link/token flow). */
export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

/** Code-based email verification (6-digit code entered in the app). */
export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

/** Register no longer auto-logs-in: the account starts unverified and the user
 *  must confirm the emailed code before signing in. */
export interface RegisterResult {
  email: string;
  verificationRequired: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface AuthResponseData {
  user: User;
  tokens: AuthTokens;
  /**
   * Long-lived Keycloak offline refresh token, returned only to native clients
   * that requested it (biometric persistent login). Absent on the web.
   */
  offlineToken?: string;
}
