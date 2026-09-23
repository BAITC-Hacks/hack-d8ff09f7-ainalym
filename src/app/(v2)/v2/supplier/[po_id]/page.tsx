import type { Metadata } from "next";
import { supplierChannel } from "@/peers/supplier";
import { PageHead, Unavailable } from "@/components/v2/ui";
import { SupplierDraft, type SupplierInitial } from "./SupplierDraft";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Черновик заказа поставщику" };

export default async function Page({ params }: { params: Promise<{ po_id: string }> }) {
  const { po_id } = await params;
  const id = decodeURIComponent(po_id);
  let initial: SupplierInitial | null = null; let failure: { status: number; code: string } | null = null;
  try {
    const data = supplierChannel(id);
    // SQLite rows carry a null prototype; only plain objects may cross into the client component.
    initial = JSON.parse(JSON.stringify({ order: data.order, lines: data.lines, channel: data.channel, state_version: data.state_version })) as SupplierInitial;
  } catch (error) {
    const e = error as { status?: number; code?: string; message?: string };
    failure = { status: e.status ?? 500, code: e.code ?? e.message ?? "unavailable" };
  }
  if (!initial) return <>
    <PageHead crumbs={[{ href: "/v2/money", label: "Деньги" }, { label: "Поставщик" }]} title={failure?.status === 404 ? "Заказ не найден" : "Страница поставщика недоступна"} />
    <Unavailable title={failure?.status === 404 ? `Заказ «${id}» отсутствует` : "Не удалось прочитать заказ"} detail={failure?.status === 404 ? "Черновик появляется после утверждения предложения «Заказ поставщику» в очереди решений." : `Код ошибки: ${failure?.code}`} />
  </>;
  return <SupplierDraft poId={id} initial={initial} />;
}
