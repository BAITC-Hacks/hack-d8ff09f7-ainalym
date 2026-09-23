import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/tokens.css";
import "./globals.css";
const inter = localFont({ src: "../../public/fonts/InterVariable.woff2", variable: "--font-inter", display: "swap", weight: "100 900", fallback: ["Arial", "PingFang SC", "Microsoft YaHei"] });
export const metadata: Metadata = { title: { default: "Айналым — Сегодня", template: "%s · Айналым" }, description: "Агенты ведут закупочный цикл. Вы принимаете решения." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" className={inter.variable}><body>{children}</body></html>;
}
