import type { Metadata } from "next";
import { serverT } from "@/app/i18n/server";
import { LegalDocument } from "@/app/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverT();
  return { title: t("legal.terms"), description: t("meta.terms.description") };
}

export default function TermsPage() {
  return <LegalDocument page="terms" />;
}
