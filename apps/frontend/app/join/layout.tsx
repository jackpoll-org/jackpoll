import { pageMetadata } from "@/app/lib/og/image";

export const generateMetadata = () => pageMetadata("join");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
