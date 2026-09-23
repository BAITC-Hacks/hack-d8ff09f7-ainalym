import type { Metadata } from "next";
import { OrdersView } from "./OrdersView";
export const metadata: Metadata = { title: "Заказы" };
export default function Page() { return <OrdersView />; }
