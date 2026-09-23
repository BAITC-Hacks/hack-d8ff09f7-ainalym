"use client";
import { useState, type FormEvent } from "react";
import { Button, apiRequest, useApiAction } from "@/components/shell";
import { number, type Recommendation } from "./types";
import styles from "./workspace.module.css";

export function QuantityEditor({
  row,
  onClose,
  historical = false,
}: {
  row: Recommendation;
  onClose: () => void;
  historical?: boolean;
}) {
  const [qty, setQty] = useState(
    String(row.qty_adjusted ?? row.qty_recommended ?? ""),
  );
  const [reason, setReason] = useState("");
  // Keep the version the user began editing; polling must not silently rebase their choice.
  const [version, setVersion] = useState(row.version);
  const [recordId, setRecordId] = useState(row.id);
  const [validation, setValidation] = useState("");
  const action = useApiAction();
  const changed = recordId !== row.id || version !== row.version;
  const stale = action.error?.status === 409 || changed;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (historical) return;
    if (
      !qty.trim() ||
      !Number.isSafeInteger(Number(qty)) ||
      Number(qty) < 0 ||
      !reason.trim()
    ) {
      setValidation(
        "Укажите целое количество не меньше нуля и причину изменения.",
      );
      return;
    }
    setValidation("");
    await action.run(
      () =>
        apiRequest(
          `/api/recommendations/${encodeURIComponent(recordId)}/adjust`,
          {
            method: "POST",
            body: JSON.stringify({
              qty: Number(qty),
              reason: reason.trim(),
              version,
            }),
          },
        ),
      "Количество сохранено. Рекомендация агента осталась в истории.",
    );
  }
  return (
    <form
      className={styles.inlineEditor}
      onSubmit={save}
      aria-busy={action.busy}
      aria-label={`Изменить количество ${row.code_1c}`}
    >
      <p>
        Рекомендация агента: <strong>{number(row.qty_recommended)} шт.</strong>{" "}
        · кратность {number(row.moq ?? row.components?.moq)}
      </p>
      <div className={styles.inlineFields}>
        <label className={styles.field}>
          Ваше количество
          <input
            autoFocus
            name="qty"
            type="number"
            min="0"
            step="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </label>
        <label className={styles.field}>
          Причина изменения
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
      </div>
      {stale && !action.receipt && (
        <div className={`${styles.notice} ${styles.warning}`} role="alert">
          Появилась новая версия. Ваше количество и причина сохранены в форме.
          Сверьте текущую рекомендацию: {number(row.qty_recommended)} шт.
          {changed && (
            <Button
              type="button"
              onClick={() => {
                setVersion(row.version);
                setRecordId(row.id);
              }}
            >
              Использовать версию {row.version}
            </Button>
          )}
        </div>
      )}
      {version === undefined && (
        <p className={styles.notice}>
          Версия рекомендации ещё не получена. Изменение будет доступно после
          обновления данных.
        </p>
      )}
      {historical && (
        <p className={styles.notice}>
          Это предыдущий расчёт. Ваш ввод сохранён; откройте актуальные
          рекомендации перед изменением.
        </p>
      )}
      <p className={`${styles.status} ${styles.error}`} role="status">
        {validation ||
          (action.error?.status !== 409 ? action.error?.message : "") ||
          action.receipt}
      </p>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          busy={action.busy}
          disabled={
            action.busy || version === undefined || changed || historical
          }
        >
          Сохранить количество
        </Button>
        <Button type="button" onClick={onClose} disabled={action.busy}>
          Закрыть
        </Button>
      </div>
    </form>
  );
}
