"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pencil, Play } from "lucide-react";
import { Chip, UrgencyChip } from "@/components/labels";
import {
  ActionStatus,
  Button,
  LoadError,
  Skeleton,
  apiRequest,
  useApi,
  useApiAction,
} from "@/components/shell";
import { AgentTimeline } from "./AgentTimeline";
import { QuantityEditor } from "./QuantityEditor";
import { Rationale } from "./Rationale";
import { ResultLabels } from "./ResultLabels";
import { usePageKeys } from "./usePageKeys";
import {
  date,
  money,
  number,
  type Recommendation,
  type RecommendationGroup,
  type RecommendationsResponse,
} from "./types";
import styles from "./workspace.module.css";

function RecommendationRow({
  row,
  historical = false,
}: {
  row: Recommendation;
  historical?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const canEdit =
    !historical && (!row.state || ["proposed", "adjusted"].includes(row.state));
  return (
    <Fragment>
      <tr>
        <td data-label="Код 1с" className={styles.code}>
          <Link
            href={`/skus/${encodeURIComponent(row.code_1c)}`}
            className={styles.itemTitle}
          >
            {row.code_1c}
          </Link>
        </td>
        <td data-label="Наименование" className={styles.name}>
          <Link
            href={`/skus/${encodeURIComponent(row.code_1c)}`}
            className={styles.itemTitle}
          >
            {row.name}
          </Link>
        </td>
        <td data-label="Остаток" className={styles.numeric}>
          {number(row.on_hand)}
        </td>
        <td data-label="В пути" className={styles.numeric}>
          {number(row.in_transit)}
        </td>
        <td data-label="Прогноз" className={styles.numeric}>
          {number(row.forecast_qty ?? row.components?.forecast_qty)}
          <p className={styles.rowNote}>
            {row.components?.horizon_days
              ? `${row.components.horizon_days} дн.`
              : "Горизонт не указан"}
          </p>
        </td>
        <td data-label="Рекомендовано" className={styles.numeric}>
          <strong>{number(row.qty_recommended)}</strong>
          {row.qty_adjusted !== null && row.qty_adjusted !== undefined && (
            <p className={styles.rowNote}>Ваше: {number(row.qty_adjusted)}</p>
          )}
          {canEdit && (
            <button
              className={styles.editButton}
              aria-label={`Изменить qty ${row.code_1c}`}
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil size={14} />
              Изменить
            </button>
          )}
        </td>
        <td data-label="Срочность">
          <UrgencyChip urgency={row.urgency} />
        </td>
        <td data-label="Обоснование">
          <button
            className={styles.editButton}
            aria-expanded={expanded}
            aria-controls={`why-${row.id}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Свернуть" : "Почему"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className={styles.rowDetail}>
          <td colSpan={8} id={`why-${row.id}`}>
            <Rationale row={row} />
          </td>
        </tr>
      )}
      {editing && (
        <tr className={styles.rowDetail}>
          <td colSpan={8}>
            <QuantityEditor
              row={row}
              historical={historical}
              onClose={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}
export function SupplierTable({
  group,
  query = "",
  historical = false,
}: {
  group: RecommendationGroup;
  query?: string;
  historical?: boolean;
}) {
  const [limit, setLimit] = useState(20);
  const matches = group.rows.filter((row) =>
    `${row.code_1c} ${row.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className={styles.panel}
      aria-label={`Рекомендации ${group.supplier_id}`}
    >
      <div className={styles.panelHead}>
        <div>
          <h2>{group.supplier_id}</h2>
          <p>
            {number(group.rows.length, 0)} позиций · {number(group.total_qty)}{" "}
            шт.
          </p>
        </div>
        <div>
          <strong>{money(group.total_cost)}</strong>
          <p>
            Стоимость известна: {number(group.cost_known_lines, 0)} из{" "}
            {number(group.rows.length, 0)} позиций
          </p>
        </div>
      </div>
      {matches.length ? (
        <>
          <table className={`${styles.table} ${styles.mobileCards}`}>
            <thead>
              <tr>
                <th scope="col">Код 1с</th>
                <th scope="col">Наименование</th>
                <th scope="col" className={styles.numeric}>
                  Остаток
                </th>
                <th scope="col" className={styles.numeric}>
                  В пути
                </th>
                <th scope="col" className={styles.numeric}>
                  Прогноз
                </th>
                <th scope="col" className={styles.numeric}>
                  Рекомендовано
                </th>
                <th scope="col">Срочность</th>
                <th scope="col">Обоснование</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, limit).map((row) => (
                <RecommendationRow
                  key={row.code_1c}
                  row={row}
                  historical={historical}
                />
              ))}
            </tbody>
          </table>
          {matches.length > limit && (
            <div className={styles.panelBody}>
              <Button onClick={() => setLimit((v) => v + 40)}>
                Показать ещё · осталось {number(matches.length - limit, 0)}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          По этому запросу у {group.supplier_id} ничего не найдено.
        </div>
      )}
    </section>
  );
}
function RunResults({
  path,
  query,
  historical,
}: {
  path: string;
  query: string;
  historical: boolean;
}) {
  const api = useApi<RecommendationsResponse>(path);
  return (
    <div className={styles.stack}>
      {api.loading && !api.data && (
        <div
          className={`${styles.panel} ${styles.panelBody} ${styles.pendingRegion}`}
        >
          <Skeleton lines={7} />
        </div>
      )}
      {api.error && (
        <LoadError message={api.error.message} retry={api.reload} />
      )}
      {api.data && (
        <>
          <ResultLabels result={api.data} />
          {!api.data.groups?.length ? (
            <section className={`${styles.panel} ${styles.empty}`}>
              <h2>Рекомендаций пока нет</h2>
              <p className={styles.subtitle}>
                Запустите расчёт: он сопоставит продажи, остатки и товары в
                пути. Готовые заказы появятся в проверке.
              </p>
              <Link className={styles.linkButton} href="/review">
                Открыть проверку <ArrowRight size={16} />
              </Link>
            </section>
          ) : (
            api.data.groups.map((group) => (
              <SupplierTable
                key={group.supplier_id}
                group={group}
                query={query}
                historical={historical}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
export function Replenishment({ runId }: { runId?: string }) {
  usePageKeys();
  const [supplier, setSupplier] = useState("");
  const [query, setQuery] = useState("");
  const [currentRun, setCurrentRun] = useState(runId);
  const action = useApiAction();
  const runs = useApi<{
    runs: { id: string; started_at: string; finished_at?: string | null }[];
  }>("/api/calc/runs");
  const latest = runs.data?.runs.reduce<
    (typeof runs.data.runs)[number] | undefined
  >(
    (newest, run) =>
      !newest || run.started_at > newest.started_at ? run : newest,
    undefined,
  );
  const selected =
    runs.data?.runs.find((run) => run.id === currentRun) ??
    (!currentRun ? latest : undefined);
  const historical = Boolean(
    currentRun &&
    (runs.error || runs.loading || (latest && latest.id !== currentRun)),
  );
  const params = new URLSearchParams({
    ...(currentRun ? { run_id: currentRun } : {}),
    ...(supplier ? { supplier } : {}),
  });
  const path = `/api/recommendations?${params}`;
  async function calculate() {
    const result = await action.run(
      () =>
        apiRequest<{ run_id: string; skus: number; recommended: number }>(
          "/api/calc/run",
          {
            method: "POST",
            body: JSON.stringify({ scope: supplier ? { supplier } : {} }),
          },
        ),
      (value) =>
        `Расчёт завершён: ${number(value.skus, 0)} SKU, ${number(value.recommended, 0)} рекомендаций.`,
    );
    if (result) setCurrentRun(result.run_id);
  }
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Закупки / Пополнение склада</p>
          <h1>Что заказать поставщикам</h1>
          <p className={styles.subtitle}>
            Расчёт по продажам, остаткам и товарам в пути. Количество можно
            скорректировать до утверждения.
          </p>
        </div>
        <div className={styles.actions}>
          <Link href="/review" className={styles.linkButton}>
            Проверка <ArrowRight size={16} />
          </Link>
          <Button
            data-page-key="r"
            aria-keyshortcuts="R"
            title="R — перейти к расчёту; Enter — запустить"
            variant="primary"
            onClick={calculate}
            busy={action.busy}
            disabled={action.busy}
          >
            <Play size={16} />
            Запустить расчёт
          </Button>
        </div>
      </header>
      <div>
        <div className={styles.toolbar}>
          <label className={`${styles.field} ${styles.search}`}>
            Найти товар
            <input
              data-page-key="f"
              aria-keyshortcuts="F"
              type="search"
              name="sku"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Код 1с или наименование"
            />
          </label>
          <label className={styles.field}>
            Поставщик
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">Все поставщики</option>
              <option value="IEK">IEK</option>
              <option value="SE">SE</option>
            </select>
          </label>
          {currentRun && <Chip>Выбранный расчёт</Chip>}
        </div>
        <ActionStatus error={action.error} receipt={action.receipt} />
      </div>
      <div className={styles.stack} aria-live="polite">
        {(currentRun || latest) && (
          <p className={`${styles.eyebrow} ${styles.code}`}>
            Расчёт {currentRun ?? latest?.id} ·{" "}
            {selected ? date(selected.started_at) : "дата уточняется"}
          </p>
        )}
        {historical && (
          <div className={`${styles.notice} ${styles.warning}`}>
            Есть более новый расчёт или актуальность выбранного не подтверждена.
            Предыдущие рекомендации доступны для просмотра.
            <Button onClick={() => setCurrentRun(undefined)}>
              Открыть актуальные рекомендации
            </Button>
          </div>
        )}
        {runs.error && (
          <p className={styles.rowNote}>
            История расчётов временно недоступна.
          </p>
        )}
      </div>
      <RunResults
        key={path}
        path={path}
        query={query}
        historical={historical}
      />
      <AgentTimeline />
    </div>
  );
}
