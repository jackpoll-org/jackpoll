import { pageMetadata } from "@/app/lib/og/image";

export const generateMetadata = () => pageMetadata("edit");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
