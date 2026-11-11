import type { Metadata } from "next";
import { serverT } from "@/app/i18n/server";
import { LegalDocument } from "@/app/components/legal/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverT();
  return { title: t("legal.privacy"), description: t("meta.privacy.description") };
}

export default function PrivacyPage() {
  return <LegalDocument page="privacy" />;
}
