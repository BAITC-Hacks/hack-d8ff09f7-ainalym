import type { Metadata } from "next";
import { DocumentReview } from "./DocumentReview";
export const metadata: Metadata = { title: "Сверка документа" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentReview id={decodeURIComponent(id)} />;
}
