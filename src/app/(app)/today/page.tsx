import type { Metadata } from "next";
import { Pulse } from "@/components/pulse/Pulse";
import { readApi } from "@/components/shell/server";
import type { ModesResponse } from "@/components/shell";
import type { TodayResponse, QueueResponse, LedgerResponse } from "@/components/pulse/types";
export const metadata: Metadata = { title: "Сегодня" };
export default async function TodayPage() {
  const [initial, initialQueue, initialLedger, initialModes] = await Promise.all([
    readApi<TodayResponse>("/api/today"), readApi<QueueResponse>("/api/queue"),
    readApi<LedgerResponse>("/api/agent/ledger?limit=8"), readApi<ModesResponse>("/api/modes"),
  ]);
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" }).format(new Date());
  return <Pulse initial={initial} initialQueue={initialQueue} initialLedger={initialLedger} initialModes={initialModes} date={date} />;
}
