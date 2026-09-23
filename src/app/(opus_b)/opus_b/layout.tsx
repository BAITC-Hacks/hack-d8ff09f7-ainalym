import "@/styles/opus_b/tokens.css";
import { ApiProvider } from "@/components/shell/api";
import { Shell } from "@/components/opus_b/Shell";

export default function OpusBLayout({ children }: { children: React.ReactNode }) {
  return <ApiProvider><Shell>{children}</Shell></ApiProvider>;
}
