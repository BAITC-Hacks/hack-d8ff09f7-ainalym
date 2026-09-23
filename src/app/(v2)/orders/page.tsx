import type { Metadata } from "next";
import { OrdersIndex } from "@/components/v2/OrdersIndex";
export const metadata: Metadata = { title: "Заказы" };
export default function Page() { return <OrdersIndex />; }
