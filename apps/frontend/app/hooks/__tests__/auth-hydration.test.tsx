import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

vi.mock("@/app/lib/auth/api", async (orig) => ({
  ...(await orig<typeof import("@/app/lib/auth/api")>()),
  getCurrentUserApi: vi.fn(async () => ({ success: true, data: { user: { id: "u1", email: "a@b.c" } } })),
}));
vi.mock("@/app/hooks/use-token-refresh", () => ({ useTokenRefresh: () => {} }));

import { useAuthState } from "../auth";
import { AUTH_STORAGE_KEY } from "@/app/lib/auth/constants";

const seen: { isLoading: boolean; isAuthenticated: boolean }[] = [];
function Probe() {
  const { isLoading, isAuthenticated } = useAuthState();
  seen.push({ isLoading, isAuthenticated });
  return <span>{isAuthenticated ? "in" : "out"}</span>;
}

function tree(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  seen.length = 0;
  localStorage.clear();
});

describe("useAuthState during hydration", () => {
  // The first hydration render sees the server's "no token" snapshot. Reporting
  // that as a settled "signed out" made RequireAuth send every deep link on a
  // full page load to /login (and on to /surveys) before the session loaded.
  it("never reports a settled signed-out state while a stored session is loading", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "token");
    const html = renderToString(tree(new QueryClient()));
    seen.length = 0;
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, tree(new QueryClient()));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(seen.some((s) => !s.isLoading && !s.isAuthenticated)).toBe(false);
    expect(seen.at(-1)).toEqual({ isLoading: false, isAuthenticated: true });
  });

  it("settles as signed out after hydration when there is no session", async () => {
    const html = renderToString(tree(new QueryClient()));
    seen.length = 0;
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, tree(new QueryClient()));
    });

    expect(seen.at(-1)).toEqual({ isLoading: false, isAuthenticated: false });
  });
});
