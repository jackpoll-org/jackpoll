"use client";

import { useInstanceLegal } from "./instance-legal-context";
import { LegalNav } from "./legal-nav";

export function LegalFooter() {
  const { links, operator } = useInstanceLegal();
  if (!links.imprint && !links.privacy && !links.terms && !operator) return null;

  return (
    <footer className="mt-auto border-t px-4 py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <LegalNav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        </LegalNav>
        {operator && <p>© {new Date().getFullYear()} {operator}</p>}
      </div>
    </footer>
  );
}
