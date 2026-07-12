import { Header } from "@/app/components/common/header";
import { LegalFooter } from "@/app/components/legal/legal-footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <LegalFooter />
    </div>
  );
}
