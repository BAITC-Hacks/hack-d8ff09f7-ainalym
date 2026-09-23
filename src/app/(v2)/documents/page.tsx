import type { Metadata } from "next";
import { DocumentsInbox } from "./DocumentsInbox";
export const metadata: Metadata = { title: "Документы" };
export default function Page() { return <DocumentsInbox />; }
