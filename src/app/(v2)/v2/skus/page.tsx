import type { Metadata } from "next";
import { Suspense } from "react";
import { SkuList } from "./SkuList";

export const metadata: Metadata = { title: "Товары" };
export default function Page() { return <Suspense fallback={null}><SkuList /></Suspense>; }
