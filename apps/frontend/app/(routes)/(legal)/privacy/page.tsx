import type { Metadata } from "next";
import { PrivacyContent } from "@/app/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy · Datenschutz",
  description: "Privacy policy / Datenschutzerklärung for Jackpoll.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
