import { House, Package, ClipboardCheck, Wallet, Boxes, AudioLines, Workflow } from "lucide-react";
export const navigation = [
  { href: "/today", label: "Сегодня", icon: House, key: "t" },
  { href: "/replenishment", label: "Закупки", icon: Package, key: "z" },
  { href: "/review", label: "Проверка", icon: ClipboardCheck, key: "p" },
  { href: "/skus", label: "Товары", icon: Boxes, key: "s", unavailable: "Каталог товаров пока недоступен. Откройте товар из расчёта пополнения." },
  { href: "/money", label: "Деньги", icon: Wallet, key: "m" },
  { href: "/connections", label: "Связи", icon: Workflow, key: "c" },
  { href: "/assistant", label: "Помощник", icon: AudioLines, key: "a" },
] as const;
