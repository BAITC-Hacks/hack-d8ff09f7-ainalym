"use client";
/* Thin document client: real endpoints first, the local fixture when the API is absent. Every answer carries its source so screens can say «пример». */
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest, useApiSync } from "@/components/shell/api";
import { FIXTURE_DOC_ID, FIXTURE_NAME, FIXTURE_PO_ID, fixtureDocument, fixturePackage } from "./fixture";
import type { IntakeDocument, OrderPackage, SupplyRoute } from "./types";
import { needsAttention } from "./types";

export type Source = "api" | "fixture";
export type Loaded<T> = { data: T; source: Source };

/** The route is missing (not deployed) rather than answering «not found» for a real id. */
const absent = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500 || (e.status === 404 && e.code !== "not_found") || (e.status === 400 && e.code === "invalid_document"));

/** Files chosen in this session keep an object URL so the review page can show the image itself. */
const previews = new Map<string, string>();
export const previewUrl = (id: string) => previews.get(id) ?? null;

export async function listDocuments(): Promise<Loaded<IntakeDocument[]>> {
  try {
    const all = await apiRequest<{ documents?: IntakeDocument[] }>("/api/documents");
    if (Array.isArray(all.documents)) return { data: all.documents, source: "api" };
  } catch (e) {
    if (absent(e) && !(e instanceof ApiError && e.status === 400)) return { data: [fixtureDocument], source: "fixture" };
  }
  // The API lists per order: fan out over the known orders (bounded) and merge.
  try {
    const orders = await apiRequest<{ orders: { id: string }[] }>("/api/orders");
    const ids = orders.orders.slice(0, 24).map(o => o.id);
    const lists = await Promise.all(ids.map(id => apiRequest<{ documents: IntakeDocument[] }>(`/api/documents?po_id=${encodeURIComponent(id)}`).then(r => r.documents).catch(e => { if (absent(e)) throw e; return [] as IntakeDocument[]; })));
    const merged = lists.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { data: merged, source: "api" };
  } catch (e) {
    if (absent(e)) return { data: [fixtureDocument], source: "fixture" };
    throw e;
  }
}

export async function getDocument(id: string): Promise<Loaded<IntakeDocument>> {
  try { return { data: (await apiRequest<{ document: IntakeDocument }>(`/api/documents/${encodeURIComponent(id)}`)).document, source: "api" }; }
  catch (e) { if (id === FIXTURE_DOC_ID && (absent(e) || (e instanceof ApiError && e.status === 404))) return { data: fixtureDocument, source: "fixture" }; throw e; }
}

export async function ingestFixture(): Promise<Loaded<IntakeDocument>> {
  try { return { data: (await apiRequest<{ document: IntakeDocument }>("/api/documents", { method: "POST", body: JSON.stringify({ fixture: FIXTURE_NAME }) })).document, source: "api" }; }
  catch (e) { if (absent(e)) return { data: fixtureDocument, source: "fixture" }; throw e; }
}

export async function uploadDocument(file: File, po_id?: string | null): Promise<Loaded<IntakeDocument>> {
  const form = new FormData(); form.append("file", file); if (po_id) form.append("po_id", po_id);
  let response: Response;
  try { response = await fetch("/api/documents", { method: "POST", body: form }); }
  catch { throw new ApiError(0, "network", "Нет связи — файл не отправлен"); }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) throw new ApiError(response.status, body?.code ?? "unavailable", body?.message ?? (response.status === 404 ? "Сервер документов не запущен — откройте пример" : "Файл не принят"));
  const document = body.document as IntakeDocument;
  if (file.type.startsWith("image/")) previews.set(document.id, URL.createObjectURL(file));
  return { data: document, source: "api" };
}

export async function acceptDocument(id: string, version: number): Promise<IntakeDocument> {
  return (await apiRequest<{ document: IntakeDocument }>(`/api/documents/${encodeURIComponent(id)}/accept`, { method: "POST", body: JSON.stringify({ version }) })).document;
}

export async function getPackage(po_id: string): Promise<Loaded<OrderPackage>> {
  try {
    const r = await apiRequest<OrderPackage & { ok: true }>(`/api/orders/${encodeURIComponent(po_id)}/package`);
    return { data: { route: r.route, route_note_ru: r.route_note_ru ?? null, items: r.items, drafts: r.drafts ?? {}, stage_rail: r.stage_rail }, source: "api" };
  } catch (e) {
    if (absent(e) || po_id === FIXTURE_PO_ID) return { data: fixturePackage("eaeu", true), source: "fixture" };
    throw e;
  }
}

export async function setRoute(supplier_id: string, route: SupplyRoute): Promise<Source> {
  try { await apiRequest(`/api/suppliers/${encodeURIComponent(supplier_id)}`, { method: "PATCH", body: JSON.stringify({ route }) }); return "api"; }
  catch (e) { if (absent(e)) return "fixture"; throw e; }
}

/** Count for the rail badge: documents that still need a person (everything not accepted). Cheap: one list per state revision. */
export function useDocumentsAttention(): number | undefined {
  const { revision } = useApiSync();
  const [count, setCount] = useState<number | undefined>(undefined);
  useEffect(() => {
    let disposed = false;
    listDocuments().then(r => { if (!disposed) setCount(r.data.filter(needsAttention).length); }).catch(() => { if (!disposed) setCount(undefined); });
    return () => { disposed = true; };
  }, [revision]);
  return count;
}

export function useLoaded<T>(load: () => Promise<Loaded<T>>, deps: unknown[]) {
  const { revision } = useApiSync();
  const [state, setState] = useState<{ data?: T; source?: Source; error: ApiError | null; loading: boolean }>({ error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let disposed = false;
    load().then(r => { if (!disposed) setState({ data: r.data, source: r.source, error: null, loading: false }); })
      .catch(e => { if (!disposed) setState(s => ({ ...s, error: e instanceof ApiError ? e : new ApiError(500, "unknown", "Не удалось загрузить данные."), loading: false })); });
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, attempt, ...deps]);
  return { ...state, reload };
}
