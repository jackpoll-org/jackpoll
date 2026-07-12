import { Header } from "@/app/components/common/header";
import { LegalFooter } from "@/app/components/legal/legal-footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}
