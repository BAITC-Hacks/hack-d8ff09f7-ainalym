/** Page context for the assistant: what the user is looking at, in plain terms. Pure, shell-agnostic. */
export type AssistantRoute = "money" | "supplier" | "sku" | "today" | "replenishment" | "orders" | "suppliers" | "world" | "assistant" | "other";
export type AssistantEntity = { supplier_id?: string; po_id?: string; code_1c?: string; proposal_id?: string; recommendation_id?: string };
export type AssistantContext = { route: AssistantRoute; entity: AssistantEntity; summary?: string };
export type SuggestedPrompt = { id: string; text: string };

const ROUTES: AssistantRoute[] = ["money", "supplier", "sku", "today", "replenishment", "orders", "suppliers", "world", "assistant", "other"];
/** Shell prefixes that may precede the route (the Opus A shell is served at /opus_a today and at / later). */
export const SHELL_PREFIXES = ["/opus_a", "/v2"];
export function detectBase(pathname: string): string { return SHELL_PREFIXES.find(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? ""; }
const ENTITY_KEYS: (keyof AssistantEntity)[] = ["supplier_id", "po_id", "code_1c", "proposal_id", "recommendation_id"];

function safeDecode(value: string): string { try { return decodeURIComponent(value); } catch { return value; } }
function cleanId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() && value.length <= 80 && !/[<>"'\\]/.test(value) ? value.trim() : undefined;
}

/** Merge a `data-ainalym-context` JSON attribute (optional) into a context. Malformed input is ignored. */
export function mergeAttribute(context: AssistantContext, attr?: string | null): AssistantContext {
  if (!attr) return context;
  let parsed: unknown;
  try { parsed = JSON.parse(attr); } catch { return context; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return context;
  const data = parsed as Record<string, unknown>;
  const entity = { ...context.entity };
  const nested = data.entity && typeof data.entity === "object" && !Array.isArray(data.entity) ? data.entity as Record<string, unknown> : {};
  for (const key of ENTITY_KEYS) { const value = cleanId(data[key]) ?? cleanId(nested[key]); if (value) entity[key] = value; }
  const route = typeof data.route === "string" && ROUTES.includes(data.route as AssistantRoute) ? data.route as AssistantRoute : context.route;
  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim().slice(0, 280) : context.summary;
  return { route, entity, ...(summary ? { summary } : {}) };
}

/** Build the context from a pathname (with the shell prefix, e.g. "/v2") and an optional page attribute. */
export function pageContext(pathname: string, base = "", attr?: string | null): AssistantContext {
  const clean = (pathname || "/").split(/[?#]/)[0];
  const prefix = base || detectBase(clean);
  const path = prefix && clean.startsWith(prefix) ? clean.slice(prefix.length) || "/" : clean;
  const seg = path.split("/").filter(Boolean).map(safeDecode);
  const entity: AssistantEntity = {};
  let route: AssistantRoute = "other";
  if (seg[0] === "money") route = "money";
  else if (seg[0] === "supplier") { route = "supplier"; const id = cleanId(seg[1]); if (id) entity.po_id = id; }
  else if (seg[0] === "orders") { route = "orders"; const id = cleanId(seg[1]); if (id) entity.po_id = id; }
  else if (seg[0] === "suppliers") { route = "suppliers"; const id = cleanId(seg[1]); if (id) entity.supplier_id = id; }
  else if (seg[0] === "skus") { route = "sku"; const code = cleanId(seg[1]); if (code) entity.code_1c = code; }
  else if (seg[0] === "today") route = "today";
  else if (seg[0] === "replenishment") { route = "replenishment"; const id = cleanId(seg[1]); if (id) entity.proposal_id = id; }
  else if (seg[0] === "world") route = "world";
  else if (seg[0] === "assistant") route = "assistant";
  return mergeAttribute({ route, entity }, attr);
}

/** Parse a context carried in a URL (`?ctx=`). Returns null when it is not a valid context. */
export function parseContext(raw: string | null | undefined): AssistantContext | null {
  if (!raw) return null;
  const merged = mergeAttribute({ route: "other", entity: {} }, raw);
  try { const data = JSON.parse(raw) as { route?: unknown }; if (typeof data.route !== "string" || !ROUTES.includes(data.route as AssistantRoute)) return null; } catch { return null; }
  return merged;
}

export function encodeContext(context: AssistantContext): string { return encodeURIComponent(JSON.stringify(context)); }

/** Suggested questions per page. Every one of them gets a real, data-backed answer without any AI key. */
export function suggestedPrompts(context: AssistantContext): SuggestedPrompt[] {
  switch (context.route) {
    case "money": return [{ id: "pay_week", text: "Что заплатить на этой неделе?" }, { id: "urgent", text: "Что срочно?" }, { id: "needs_me", text: "Что нужно от меня?" }];
    case "supplier": return [{ id: "why_order", text: "Почему заказ такой?" }, { id: "urgent", text: "Что срочно?" }, { id: "pay_week", text: "Что заплатить на этой неделе?" }];
    case "orders": return context.entity.po_id
      ? [{ id: "why_order", text: "Почему заказ такой?" }, { id: "urgent", text: "Что срочно?" }, { id: "pay_week", text: "Что заплатить на этой неделе?" }]
      : [{ id: "pay_week", text: "Что заплатить на этой неделе?" }, { id: "needs_me", text: "Что нужно от меня?" }, { id: "urgent", text: "Что срочно?" }];
    case "suppliers": return [{ id: "urgent", text: "Что срочно?" }, { id: "pay_week", text: "Что заплатить на этой неделе?" }, { id: "needs_me", text: "Что нужно от меня?" }];
    case "sku": return [{ id: "why_qty", text: "Почему столько?" }, { id: "what_if_transit", text: "Что изменится, если +100 в пути?" }, { id: "urgent", text: "Что срочно?" }];
    case "world": return [{ id: "changed", text: "Что изменилось?" }, { id: "urgent", text: "Что срочно?" }, { id: "needs_me", text: "Что нужно от меня?" }];
    default: return [{ id: "needs_me", text: "Что нужно от меня?" }, { id: "urgent", text: "Что срочно?" }, { id: "changed", text: "Что изменилось?" }];
  }
}

/** Short human title for the header pill. */
export function contextTitle(context: AssistantContext): string {
  switch (context.route) {
    case "money": return "Деньги";
    case "supplier": return context.entity.po_id ? `Заказ ${context.entity.po_id}` : "Заказ поставщику";
    case "orders": return context.entity.po_id ? `Заказ ${context.entity.po_id}` : "Заказы";
    case "suppliers": return context.entity.supplier_id ? `Поставщик ${context.entity.supplier_id}` : "Поставщики";
    case "sku": return context.entity.code_1c ? `Позиция ${context.entity.code_1c}` : "Позиция";
    case "today": return "Сегодня";
    case "replenishment": return "Пополнение";
    case "world": return "События";
    default: return "Весь склад";
  }
}
