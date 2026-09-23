import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const ACCESS_COOKIE = "ainalym_demo_access";
export const ACCESS_DAYS = 7;
const DAY_MS = 86_400_000;
const API_CAPACITY = 60;
const API_REFILL_PER_MS = API_CAPACITY / 60_000;

type Bucket = { tokens: number; at: number };
const apiBuckets = new Map<string, Bucket>();
const accessBuckets = new Map<string, Bucket>();

export function guardEnabled(): boolean {
  return Boolean(process.env.DEMO_ACCESS_CODE);
}

function signature(expires: number, code: string): string {
  return createHmac("sha256", code).update(`ainalym-demo:${expires}`).digest("hex");
}

export function issueAccessCookie(code: string, now = Date.now()): string {
  const expires = now + ACCESS_DAYS * DAY_MS;
  return `${expires}.${signature(expires, code)}`;
}

export function hasAccess(cookie: string | undefined, code: string, now = Date.now()): boolean {
  if (!cookie) return false;
  const match = /^(\d{13})\.([0-9a-f]{64})$/.exec(cookie);
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires <= now || expires > now + ACCESS_DAYS * DAY_MS) return false;
  const received = Buffer.from(match[2], "hex");
  const expected = Buffer.from(signature(expires, code), "hex");
  return timingSafeEqual(received, expected);
}

export function validCode(candidate: string, code: string): boolean {
  const received = createHmac("sha256", "ainalym-demo-code").update(candidate).digest();
  const expected = createHmac("sha256", "ainalym-demo-code").update(code).digest();
  return timingSafeEqual(received, expected);
}

function takeToken(buckets: Map<string, Bucket>, ip: string, capacity: number, refillPerMs: number, now: number): boolean {
  const previous = buckets.get(ip);
  const tokens = Math.min(capacity, (previous?.tokens ?? capacity) + (previous ? (now - previous.at) * refillPerMs : 0));
  const allowed = tokens >= 1;
  buckets.set(ip, { tokens: allowed ? tokens - 1 : tokens, at: now });
  if (buckets.size > 10_000) {
    for (const [key, bucket] of buckets) if (now - bucket.at > 120_000) buckets.delete(key);
  }
  return allowed;
}

export function allowApiRequest(ip: string, now = Date.now()): boolean {
  return takeToken(apiBuckets, ip, API_CAPACITY, API_REFILL_PER_MS, now);
}

export function allowCodeAttempt(ip: string, now = Date.now()): boolean {
  return takeToken(accessBuckets, ip, 5, 5 / 60_000, now);
}

export function dailyLimit(): number {
  const configured = Number(process.env.DEMO_DAILY_LIVE_CALLS);
  return process.env.DEMO_DAILY_LIVE_CALLS && Number.isSafeInteger(configured) && configured >= 0
    ? configured : 500;
}

function budgetPath(): string {
  const databasePath = process.env.DATABASE_PATH || join(process.cwd(), "data", "ainalym.db");
  return databasePath === ":memory:" ? ":memory:" : join(dirname(databasePath), "demo_guard.db");
}

function budgetDb(): DatabaseSync {
  const path = budgetPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA busy_timeout = 3000");
  database.exec("CREATE TABLE IF NOT EXISTS demo_daily_budget (day TEXT PRIMARY KEY, used INTEGER NOT NULL)");
  return database;
}

function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function remainingDailyCalls(now = Date.now()): number {
  const database = budgetDb();
  try {
    const row = database.prepare("SELECT used FROM demo_daily_budget WHERE day = ?").get(dayKey(now)) as { used: number } | undefined;
    return Math.max(0, dailyLimit() - (row?.used ?? 0));
  } finally {
    database.close();
  }
}

// Call immediately before every live provider request, including worker and voice calls.
// A rejected reservation must return provider_error/503, never a replay or rules success.
export function reserveLiveCall(now = Date.now()): { allowed: boolean; remaining: number } {
  if (!guardEnabled() || process.env.AINALYM_MODE !== "live") return { allowed: true, remaining: dailyLimit() };
  const database = budgetDb();
  try {
    database.exec("BEGIN IMMEDIATE");
    const day = dayKey(now);
    const row = database.prepare("SELECT used FROM demo_daily_budget WHERE day = ?").get(day) as { used: number } | undefined;
    const used = row?.used ?? 0;
    if (used >= dailyLimit()) {
      database.exec("COMMIT");
      return { allowed: false, remaining: 0 };
    }
    database.prepare("INSERT INTO demo_daily_budget (day, used) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET used = used + 1").run(day);
    database.exec("COMMIT");
    return { allowed: true, remaining: dailyLimit() - used - 1 };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

// Realtime follow-ups share their originating user turn's reservation.
export function reserveLiveTurn(turnId: string, now = Date.now()): { allowed: boolean; remaining: number } {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(turnId)) return { allowed: false, remaining: 0 };
  if (!guardEnabled() || process.env.AINALYM_MODE !== "live") return { allowed: true, remaining: dailyLimit() };
  const database = budgetDb();
  try {
    database.exec("CREATE TABLE IF NOT EXISTS demo_voice_turn (day TEXT NOT NULL, turn_id TEXT NOT NULL, PRIMARY KEY(day, turn_id))");
    database.exec("BEGIN IMMEDIATE");
    const day = dayKey(now);
    const row = database.prepare("SELECT used FROM demo_daily_budget WHERE day = ?").get(day) as { used: number } | undefined;
    const used = row?.used ?? 0;
    const prior = database.prepare("SELECT 1 FROM demo_voice_turn WHERE day = ? AND turn_id = ?").get(day, turnId);
    if (prior) { database.exec("COMMIT"); return { allowed: true, remaining: Math.max(0, dailyLimit() - used) }; }
    if (used >= dailyLimit()) { database.exec("COMMIT"); return { allowed: false, remaining: 0 }; }
    database.prepare("INSERT INTO demo_voice_turn (day, turn_id) VALUES (?, ?)").run(day, turnId);
    database.prepare("INSERT INTO demo_daily_budget (day, used) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET used = used + 1").run(day);
    database.exec("COMMIT");
    return { allowed: true, remaining: dailyLimit() - used - 1 };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally { database.close(); }
}

export function providerUnavailable(): Response {
  return Response.json({ error: "Provider unavailable", label: "Провайдер недоступен", ai: "unavailable", offline_path: "Правила без LLM · локальный запуск по README" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

// Pass this to SDK clients as their fetch implementation, and use it for direct
// provider fetches. Reserving here counts retries and fallbacks separately.
export async function guardedProviderFetch(input: RequestInfo | URL, init?: RequestInit, upstream: typeof fetch = fetch): Promise<Response> {
  try {
    if (!reserveLiveCall().allowed) return providerUnavailable();
  } catch {
    return providerUnavailable();
  }
  return upstream(input, init);
}
