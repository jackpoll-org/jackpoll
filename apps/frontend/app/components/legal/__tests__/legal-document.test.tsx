import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("../built-in", () => ({
  BUILT_IN_LEGAL: { imprint: () => <p>built-in imprint</p> },
}));
vi.mock("@/app/lib/legal/built-in", () => ({
  BUILT_IN_PAGES: ["imprint"],
  BUILT_IN_OPERATOR: null,
}));

import { LegalDocument } from "../legal-document";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LegalDocument", () => {
  it("renders the operator's Markdown file without raw HTML", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "legal-")), "privacy.md");
    writeFileSync(file, "# Datenschutz\n\nBetreiber: Verein e.V.\n\n<script>alert(1)</script>");
    vi.stubEnv("LEGAL_PRIVACY_FILE", file);
    const html = renderToStaticMarkup(await LegalDocument({ page: "privacy" }));
    expect(html).toContain("<h1>Datenschutz</h1>");
    expect(html).toContain("Betreiber: Verein e.V.");
    expect(html).not.toContain("<script>");
  });

  it("redirects to a configured external page", async () => {
    vi.stubEnv("LEGAL_IMPRINT_URL", "https://example.org/impressum");
    await expect(LegalDocument({ page: "imprint" })).rejects.toThrow("redirect:https://example.org/impressum");
  });

  it("falls back to the built-in page", async () => {
    vi.stubEnv("LEGAL_IMPRINT_URL", "");
    const html = renderToStaticMarkup(await LegalDocument({ page: "imprint" }));
    expect(html).toContain("built-in imprint");
  });

  it("returns 404 and logs when the configured file is missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("LEGAL_PRIVACY_FILE", "/does/not/exist.md");
    await expect(LegalDocument({ page: "privacy" })).rejects.toThrow("not-found");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("/does/not/exist.md"), expect.anything());
    error.mockRestore();
  });

  it("returns 404 when nothing is configured", async () => {
    await expect(LegalDocument({ page: "terms" })).rejects.toThrow("not-found");
  });
});
