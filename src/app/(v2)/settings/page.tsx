import type { Metadata } from "next";
import { SettingsPage } from "./SettingsPage";
import { PageContext } from "@/components/assistant/PageContext";

export const metadata: Metadata = { title: "Настройки" };
export default function Page() { return <><PageContext value={{ route: "settings" }} /><SettingsPage /></>; }
