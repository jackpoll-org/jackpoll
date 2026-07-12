import { API_BASE_URL, AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";
import { SURVEY_ENDPOINTS } from "@/app/lib/survey/constants";
import type { ApiResponse } from "@/app/types/auth";
import type { CreateTemplateInput, CustomTemplateDto } from "./types";

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token =
    typeof window !== "undefined" ? localStorage.getItem(AUTH_STORAGE_KEY) : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return body as ApiResponse<T>;
}

export async function listTemplatesApi(): Promise<ApiResponse<CustomTemplateDto[]>> {
  return request<CustomTemplateDto[]>(SURVEY_ENDPOINTS.templates);
}

export async function createTemplateApi(
  data: CreateTemplateInput,
): Promise<ApiResponse<CustomTemplateDto>> {
  return request<CustomTemplateDto>(SURVEY_ENDPOINTS.templates, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTemplateApi(id: string): Promise<ApiResponse<null>> {
  return request<null>(SURVEY_ENDPOINTS.template(id), { method: "DELETE" });
}
