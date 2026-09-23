import { db } from "@/db/client";

export function orgId(): string {
  return (db().prepare("SELECT id FROM organization LIMIT 1").get() as { id: string } | undefined)?.id || "DEMO-PARTNER-A";
}
