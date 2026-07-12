// ── Operator / controller details for the legal pages (#61/#62) ────
//
// Jackpoll is a Quavon product. Defaults are the Quavon operator details; a
// self-host operator overrides them via NEXT_PUBLIC_LEGAL_* env vars so the
// Impressum/privacy pages show *their* legal entity without code changes.

export interface LegalConfig {
  /** Legal/operator name (natural or legal person). */
  operator: string;
  /** Trading/brand name shown alongside the operator. */
  brand: string;
  street: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  /** Person responsible for content per §18 Abs. 2 MStV. */
  responsible: string;
  /** Competent supervisory authority (for the privacy notice). */
  supervisoryAuthority: string;
  /** Last review date shown on the documents. */
  lastUpdated: string;
}

const env = (key: string, fallback: string): string =>
  (process.env[key] ?? "").trim() || fallback;

export const LEGAL: LegalConfig = {
  operator: env("NEXT_PUBLIC_LEGAL_OPERATOR", "Leopold Link"),
  brand: env("NEXT_PUBLIC_LEGAL_BRAND", "Quavon"),
  street: env("NEXT_PUBLIC_LEGAL_STREET", "Langbehnstraße 39"),
  city: env("NEXT_PUBLIC_LEGAL_CITY", "83022 Rosenheim"),
  country: env("NEXT_PUBLIC_LEGAL_COUNTRY", "Deutschland"),
  email: env("NEXT_PUBLIC_LEGAL_EMAIL", "contact@quavon.de"),
  phone: env("NEXT_PUBLIC_LEGAL_PHONE", "+49 (0) 175 4251056"),
  responsible: env("NEXT_PUBLIC_LEGAL_RESPONSIBLE", "Leopold Link"),
  supervisoryAuthority: env(
    "NEXT_PUBLIC_LEGAL_AUTHORITY",
    "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Ansbach",
  ),
  lastUpdated: env("NEXT_PUBLIC_LEGAL_UPDATED", "2026-06-25"),
};
