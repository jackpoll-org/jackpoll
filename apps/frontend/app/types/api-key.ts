export type ApiKeyScope = "surveys" | "responses";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface CreatedApiKey {
  apiKey: ApiKey;
  secret: string;
}
