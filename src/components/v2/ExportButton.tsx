"use client";
import { useState } from "react";
import { Download } from "lucide-react";

const ERRORS: Record<string, string> = {
  purchase_order_not_approved: "Экспорт доступен после утверждения заказа.",
  unknown_po: "Заказ не найден — обновите страницу.",
  invalid_po: "Заказ не найден — обновите страницу.",
  export_file_missing: "Файл экспорта ещё не подготовлен — попробуйте через минуту.",
  no_lines: "В заказе нет строк — экспортировать нечего.",
  empty_po: "В заказе нет строк — экспортировать нечего.",
};

function filenameFrom(header: string | null, fallback: string): string {
  const utf = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) { try { return decodeURIComponent(utf); } catch { /* fall through */ } }
  return header?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

/** Downloads the 1C export through fetch so the access cookie travels with the request and errors stay in plain language. */
export function ExportButton({ poId, format = "xlsx", lines, className, children }: { poId: string; format?: "xlsx" | "csv"; lines?: number; className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setError("");
    if (lines === 0) { setError(ERRORS.no_lines); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(poId)}/export.${format}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        let code = "";
        try { code = String((await response.json()).code ?? ""); } catch { /* not json */ }
        setError(ERRORS[code] ?? (response.status === 401 ? "Сессия истекла — откройте демо заново." : "Файл экспорта пока не готов — попробуйте позже."));
        return;
      }
      const blob = await response.blob();
      const name = filenameFrom(response.headers.get("content-disposition"), `Заказ_поставщику.${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("Не удалось скачать файл — проверьте соединение.");
    } finally { setBusy(false); }
  }
  return <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <button type="button" className={className} onClick={download} disabled={busy} aria-busy={busy} data-export={format}><Download size={14} aria-hidden />{children ?? (format === "xlsx" ? "Экспорт для 1С (файл)" : "csv")}</button>
    {error && <span role="alert" style={{ font: "var(--v2-small, 500 12px/16px system-ui)", color: "var(--v2-danger, #a12d27)" }}>{error}</span>}
  </span>;
}
