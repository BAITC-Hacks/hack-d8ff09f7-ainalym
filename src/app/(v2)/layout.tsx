import type { Metadata } from "next";
import "@/styles/tokens.css";
import { ApiProvider } from "@/components/shell/api";
import { V2Shell } from "@/components/Shell";

export const metadata: Metadata = { title: { default: "Ainalym — Сегодня", template: "%s · Ainalym" } };

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <ApiProvider><V2Shell>{children}</V2Shell></ApiProvider>;
}
