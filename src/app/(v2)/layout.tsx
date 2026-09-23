import type { Metadata } from "next";
import "@/styles/v2/tokens.css";
import { ApiProvider } from "@/components/shell/api";
import { V2Shell } from "@/components/v2/Shell";

export const metadata: Metadata = { title: { default: "Айналым — Сегодня", template: "%s · Айналым" } };

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <ApiProvider><V2Shell>{children}</V2Shell></ApiProvider>;
}
