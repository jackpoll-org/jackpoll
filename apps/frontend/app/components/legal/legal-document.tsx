import { readFile } from "node:fs/promises";
import { notFound, redirect } from "next/navigation";
import Markdown from "react-markdown";
import { legalSource, type LegalPage } from "@/app/lib/legal/instance";
import { BUILT_IN_LEGAL } from "./built-in";
import { LegalProse } from "./legal-prose";

async function readLegalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    console.error(`Legal page file ${path} could not be read:`, error);
    return null;
  }
}

export async function LegalDocument({ page }: { page: LegalPage }) {
  const source = legalSource(page);
  if (source?.kind === "url") redirect(source.href);
  if (source?.kind === "file") {
    const markdown = await readLegalFile(source.path);
    if (markdown === null) notFound();
    return (
      <LegalProse>
        <Markdown>{markdown}</Markdown>
      </LegalProse>
    );
  }
  const BuiltIn = BUILT_IN_LEGAL[page];
  if (!BuiltIn) notFound();
  return <BuiltIn />;
}
