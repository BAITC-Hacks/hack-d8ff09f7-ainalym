import "server-only";
import { headers } from "next/headers";
/** Read the same HTTP contract on first render; absent services hydrate into their unavailable state. */
export async function readApi<T>(path: `/api/${string}`): Promise<T | undefined> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host || !/^[a-zA-Z0-9.:[\]-]+$/.test(host)) return undefined;
  const protocol = requestHeaders.get("x-forwarded-proto") === "https" ? "https" : "http";
  try {
    const response = await fetch(`${protocol}://${host}${path}`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (!response.ok) return undefined;
    const body = await response.json();
    return body?.ok === false ? undefined : body as T;
  } catch { return undefined; }
}
