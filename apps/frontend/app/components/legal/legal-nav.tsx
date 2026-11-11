"use client";

import Link from "next/link";
import { useTranslation } from "@/app/i18n/context";
import { LEGAL_PAGES, type LegalPage } from "@/app/lib/legal/instance";
import { useInstanceLegal } from "./instance-legal-context";

const LABELS = {
  imprint: "legal.imprint",
  privacy: "legal.privacy",
  terms: "legal.terms",
} as const satisfies Record<LegalPage, string>;

export function LegalNav({
  className,
  linkClassName = "hover:text-foreground hover:underline",
  newTab = false,
  children,
}: {
  className: string;
  linkClassName?: string;
  newTab?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { links } = useInstanceLegal();
  const entries = LEGAL_PAGES.flatMap((page) => {
    const href = links[page];
    return href ? [{ page, href }] : [];
  });
  if (entries.length === 0) return null;

  return (
    <nav className={className}>
      {entries.map(({ page, href }) => {
        const blank = newTab || !href.startsWith("/");
        return (
          <Link
            key={page}
            href={href}
            className={linkClassName}
            {...(blank && { target: "_blank", rel: "noopener noreferrer" })}
          >
            {t(LABELS[page])}
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
