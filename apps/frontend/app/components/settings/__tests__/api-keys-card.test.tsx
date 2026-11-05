import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ApiKey, CreatedApiKey } from "@/app/types/api-key";

const createMutate = vi.fn();
const deleteMutate = vi.fn();
let keys: ApiKey[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/i18n/context", () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, string>) =>
      vars ? `${k} ${Object.values(vars).join(" ")}` : k,
  }),
}));
vi.mock("@/app/hooks/survey", () => ({
  useApiKeys: () => ({ data: keys }),
  useCreateApiKey: () => ({ mutate: createMutate, reset: vi.fn(), isPending: false }),
  useDeleteApiKey: () => ({ mutate: deleteMutate }),
}));

import { ApiKeysCard } from "../api-keys-card";

const key: ApiKey = {
  id: "k1",
  name: "Claude",
  prefix: "jp_abcdefgh",
  scopes: ["surveys", "responses"],
  createdAt: "2026-11-05T10:00:00Z",
  lastUsedAt: null,
};

describe("ApiKeysCard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    createMutate.mockReset();
    deleteMutate.mockReset();
    keys = [];
  });

  it("creates a key with the chosen scope and shows the secret once", () => {
    createMutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess: (c: CreatedApiKey) => void }) =>
        opts.onSuccess({ apiKey: key, secret: "jp_secret-value" }),
    );
    render(<ApiKeysCard />);

    fireEvent.change(screen.getByLabelText("settings.apiKeys.name"), { target: { value: " Claude " } });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "settings.apiKeys.create" }));

    expect(createMutate).toHaveBeenCalledWith(
      { name: "Claude", readResponses: true, expiresInDays: 30 },
      expect.anything(),
    );
    expect(screen.getByText("jp_secret-value")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "settings.apiKeys.done" }));
    expect(screen.queryByText("jp_secret-value")).toBeNull();
  });

  it("shows when a key expires and marks expired keys", () => {
    keys = [
      { ...key, id: "k2", name: "Soon", expiresAt: "2999-01-01T00:00:00Z" },
      { ...key, id: "k3", name: "Old", expiresAt: "2020-01-01T00:00:00Z" },
      { ...key, id: "k4", name: "Forever", expiresAt: null },
    ];
    render(<ApiKeysCard />);

    expect(screen.getByText(/settings.apiKeys.expiresOn/)).toBeTruthy();
    expect(screen.getByText(/settings.apiKeys.expiredOn/)).toBeTruthy();
    expect(screen.getByText(/settings.apiKeys.noExpiry/)).toBeTruthy();
    expect(screen.getAllByText("settings.apiKeys.expired")).toHaveLength(1);
  });

  it("does not create a key without a name", () => {
    render(<ApiKeysCard />);
    const create = screen.getByRole("button", { name: "settings.apiKeys.create" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
  });

  it("lists keys by prefix and scope and revokes after confirming", () => {
    keys = [key];
    render(<ApiKeysCard />);

    expect(screen.getByText("jp_abcdefgh…")).toBeTruthy();
    expect(screen.getByText("settings.apiKeys.scopeResponses")).toBeTruthy();
    expect(screen.getByText(/settings.apiKeys.neverUsed/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "settings.apiKeys.revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "settings.apiKeys.revoke" }));

    expect(deleteMutate).toHaveBeenCalledWith("k1", expect.anything());
  });
});
