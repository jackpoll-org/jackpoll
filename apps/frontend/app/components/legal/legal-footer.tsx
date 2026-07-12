"use client";

import Link from "next/link";
import { useTranslation } from "@/app/i18n/context";
import { LEGAL } from "@/app/lib/legal/config";

/**
 * Compact legal footer (#61/#62/#67): Impressum + privacy + cookie links and
 * the GDPR badge. Reused on auth + public survey pages so the privacy notice is
 * reachable everywhere.
 */
export function LegalFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const badge = "/badges/GDPR-Badge.svg";

  return (
    <footer className="mt-auto border-t px-4 py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/impressum" className="hover:text-foreground hover:underline">
            {t("legal.imprint")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {t("legal.privacy")}
          </Link>
          <Link href="/privacy#cookies" className="hover:text-foreground hover:underline">
            {t("legal.cookies")}
          </Link>
        </nav>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badge}
          alt={t("legal.badgeAlt")}
          className="h-auto w-full max-w-52"
        />
        <p>© {year} {LEGAL.brand}</p>
      </div>
    </footer>
  );
}
