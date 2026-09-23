import "@/styles/opus_a/tokens.css";
import "@/styles/opus_a/ui.css";
import { ApiProvider } from "@/components/shell/api";
import { OaShell } from "@/components/opus_a/Shell";

export default function OpusALayout({ children }: { children: React.ReactNode }) {
  return <ApiProvider><OaShell>{children}</OaShell></ApiProvider>;
}
