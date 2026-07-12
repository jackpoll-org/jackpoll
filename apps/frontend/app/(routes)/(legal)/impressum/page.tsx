import type { Metadata } from "next";
import { ImpressumContent } from "@/app/components/legal/impressum-content";

export const metadata: Metadata = {
  title: "Impressum · Legal Notice",
  description: "Imprint / Impressum for Jackpoll.",
};

export default function ImpressumPage() {
  return <ImpressumContent />;
}
