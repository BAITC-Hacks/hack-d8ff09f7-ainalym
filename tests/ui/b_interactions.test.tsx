// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalReview } from "@/components/review/ProposalDesk";
import { QuantityEditor } from "@/components/purchase/QuantityEditor";
import { Replenishment } from "@/components/purchase/Replenishment";
import { type Proposal } from "@/components/review/types";
import { type Recommendation } from "@/components/purchase/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const axes = {
  provenance: "partner_anonymised",
  ai: "rules",
  external: "export_only",
};
const proposal: Proposal = {
  id: "PR-TEST",
  kind: "outlier_review",
  version: 1,
  state: "needs_review",
  rationale_ru: "Разовая продажа",
  payload: {
    code_1c: "TEST-01",
    doc_no: "DOC-TEST",
    ym: "2026-01",
    state: "excluded",
  },
  sources: ["DOC-TEST"],
  affects: ["TEST-01"],
};
const row: Recommendation = {
  id: "REC-TEST",
  code_1c: "TEST-01",
  name: "Тест",
  supplier_id: "SE",
  on_hand: 0,
  in_transit: 5,
  qty_recommended: 10,
  urgency: "soon",
  rationale_ru: "Нужно 10",
  components: { moq: 1 },
  version: 1,
};
let container: HTMLDivElement, root: Root;
let writes: { path: string; body: Record<string, unknown> }[];
let handleWrite: (
  path: string,
  body: Record<string, unknown>,
) => Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  writes = [];
  handleWrite = async () => json({ ok: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        writes.push({ path, body });
        return handleWrite(path, body);
      }
      if (path === "/api/modes") return json({ ...axes, ok: true });
      if (path.startsWith("/api/recommendations"))
        return json({ groups: [], ...axes });
      if (path.startsWith("/api/agent/ledger"))
        return json({ rows: [], stats: { auto: 0, needs_you: 0 } });
      return json(
        { ok: false, code: "not_found", message: "Данные ещё не доступны" },
        404,
      );
    }),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(element: React.ReactNode) {
  await act(async () => {
    root.render(element);
  });
}
function button(text: string) {
  const el = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.trim().startsWith(text),
  );
  if (!el) throw new Error(`Button missing: ${text}`);
  return el;
}
async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}
async function input(name: string, value: string) {
  const node = container.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("b_interactions — actual controls through API client", () => {
  it("requires a choice and sends the exact bound version", async () => {
    await render(<ProposalReview proposal={proposal} />);
    await click(button("Подтвердить решение"));
    expect(writes).toHaveLength(0);
    expect(container.textContent).toContain("Выберите");
    await click(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!,
    );
    await click(button("Подтвердить решение"));
    expect(writes).toEqual([
      { path: "/api/proposals/PR-TEST/approve", body: { proposal_version: 1 } },
    ]);
  });
  it("announces pending immediately and ignores duplicate submission", async () => {
    let finish!: (value: Response) => void;
    handleWrite = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    await render(<ProposalReview proposal={proposal} />);
    await click(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!,
    );
    const primary = button("Подтвердить решение");
    await click(primary);
    expect(primary.getAttribute("aria-busy")).toBe("true");
    expect(primary.disabled).toBe(true);
    await click(primary);
    expect(writes).toHaveLength(1);
    await act(async () => finish(json({ ok: true })));
    expect(container.textContent).toContain("Решение сохранено");
  });
  it("keeps a 409 choice checked, then requires review of the newer version", async () => {
    handleWrite = async () =>
      json({ ok: false, code: "stale", message: "Новая версия" }, 409);
    await render(<ProposalReview proposal={proposal} />);
    await click(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!,
    );
    await click(button("Подтвердить решение"));
    expect(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!
        .checked,
    ).toBe(true);
    expect(container.textContent).toContain("Ваш выбор и количества сохранены");
    await render(<ProposalReview proposal={{ ...proposal, version: 2 }} />);
    expect(button("Подтвердить решение").disabled).toBe(true);
    await click(button("Проверено"));
    handleWrite = async () => json({ ok: true });
    await click(button("Подтвердить решение"));
    expect(writes.at(-1)?.body).toEqual({ proposal_version: 2 });
  });
  it("preserves quantity and reason after failure and stale poll refresh", async () => {
    handleWrite = async () =>
      json({ ok: false, code: "stale", message: "Версия изменилась" }, 409);
    await render(<QuantityEditor row={row} onClose={() => {}} />);
    await input("qty", "7");
    await input("reason", "Подтверждённый остаток");
    await click(button("Сохранить количество"));
    expect(writes[0]).toEqual({
      path: "/api/recommendations/REC-TEST/adjust",
      body: { qty: 7, reason: "Подтверждённый остаток", version: 1 },
    });
    await render(
      <QuantityEditor
        row={{ ...row, version: 2, qty_recommended: 8 }}
        onClose={() => {}}
      />,
    );
    expect(
      container.querySelector<HTMLInputElement>('input[name="qty"]')!.value,
    ).toBe("7");
    expect(
      container.querySelector<HTMLInputElement>('input[name="reason"]')!.value,
    ).toBe("Подтверждённый остаток");
    expect(button("Сохранить количество").disabled).toBe(true);
    await click(button("Использовать версию 2"));
    handleWrite = async () => json({ ok: true });
    await click(button("Сохранить количество"));
    expect(writes.at(-1)?.body.version).toBe(2);
  });
  it("shows initial loading, then actual empty results and all truth axes", async () => {
    await render(<Replenishment />);
    expect(container.textContent).toContain("Рекомендаций пока нет");
    expect(container.textContent).toContain("Действий агента пока нет");
    for (const text of [
      "Данные партнёра · обезличены",
      "Правила без LLM",
      "Экспорт для 1С (файл)",
    ])
      expect(container.textContent).toContain(text);
  });
  it("keeps a provider failure inline without a success receipt", async () => {
    handleWrite = async () =>
      json(
        {
          ok: false,
          code: "provider_unavailable",
          message: "Провайдер недоступен",
        },
        503,
      );
    await render(<ProposalReview proposal={proposal} />);
    await click(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!,
    );
    await click(button("Подтвердить решение"));
    expect(container.textContent).toContain("Провайдер недоступен");
    expect(container.textContent).not.toContain("Решение сохранено");
    expect(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!
        .checked,
    ).toBe(true);
  });
  it("keeps the selected resolution visible when the backend marks a proposal stale", async () => {
    handleWrite = async () =>
      json({ ok: false, code: "stale", message: "Новая версия" }, 409);
    await render(<ProposalReview proposal={proposal} />);
    await click(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!,
    );
    await click(button("Подтвердить решение"));
    await render(
      <ProposalReview
        proposal={{ ...proposal, state: "stale", version: 2 }}
        successor={{ ...proposal, id: "PR-NEXT" }}
      />,
    );
    expect(
      container.querySelector<HTMLInputElement>('input[value="approve"]')!
        .checked,
    ).toBe(true);
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect(container.textContent).toContain("Ваш выбор и количества сохранены");
    expect(container.querySelector('a[href="/review/PR-NEXT"]')).not.toBeNull();
  });
  it("binds a new recommendation identity only after explicit review", async () => {
    await render(<QuantityEditor row={row} onClose={() => {}} />);
    await input("qty", "7");
    await input("reason", "Проверено");
    await render(
      <QuantityEditor
        row={{ ...row, id: "REC-NEXT", qty_recommended: 8 }}
        onClose={() => {}}
      />,
    );
    expect(button("Сохранить количество").disabled).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>('input[name="qty"]')!.value,
    ).toBe("7");
    await click(button("Использовать версию 1"));
    await click(button("Сохранить количество"));
    expect(writes[0].path).toBe("/api/recommendations/REC-NEXT/adjust");
  });
});
