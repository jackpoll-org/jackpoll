import { BUILT_IN_OPERATOR, BUILT_IN_PAGES } from "./built-in";

export const LEGAL_PAGES = ["imprint", "privacy", "terms"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export const LEGAL_ROUTES: Record<LegalPage, string> = {
  imprint: "/impressum",
  privacy: "/privacy",
  terms: "/terms",
};

export type LegalSource =
  | { kind: "url"; href: string }
  | { kind: "file"; path: string }
  | { kind: "builtin" };

export type LegalLinks = Record<LegalPage, string | null>;

export interface InstanceLegal {
  links: LegalLinks;
  operator: string | null;
}

type Env = Record<string, string | undefined>;

const reportedInvalid = new Set<string>();

export function externalUrl(value: string): string | null {
  const url = URL.parse(value);
  return url && (url.protocol === "https:" || url.protocol === "http:") ? url.href : null;
}

export function legalSource(page: LegalPage, env: Env = process.env): LegalSource | null {
  const prefix = `LEGAL_${page.toUpperCase()}`;
  const url = env[`${prefix}_URL`]?.trim();
  if (url) {
    const href = externalUrl(url);
    if (href) return { kind: "url", href };
    if (!reportedInvalid.has(url)) {
      reportedInvalid.add(url);
      console.error(`${prefix}_URL is ignored: it must be an absolute http(s) URL.`);
    }
  }
  const path = env[`${prefix}_FILE`]?.trim();
  if (path) return { kind: "file", path };
  return BUILT_IN_PAGES.includes(page) ? { kind: "builtin" } : null;
}

export function instanceLegal(env: Env = process.env): InstanceLegal {
  const links = Object.fromEntries(
    LEGAL_PAGES.map((page) => {
      const source = legalSource(page, env);
      return [page, source?.kind === "url" ? source.href : source ? LEGAL_ROUTES[page] : null];
    }),
  ) as LegalLinks;
  return { links, operator: env.LEGAL_ENTITY?.trim() || BUILT_IN_OPERATOR };
}
