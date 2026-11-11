import { API_BASE_URL } from "@/app/lib/auth/constants";

export async function registrationEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/oidc-config`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { data?: { registrationEnabled?: boolean } };
    return body.data?.registrationEnabled !== false;
  } catch {
    return true;
  }
}
