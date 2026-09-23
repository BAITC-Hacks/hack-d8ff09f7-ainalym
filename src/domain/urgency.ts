/** Canonical labels for the persisted recommendation urgency keys (CONTRACTS §5). */
export const urgencyLabelsRu = {
  critical: "критично",
  soon: "скоро",
  normal: "планово",
  none: "не требуется",
} as const;

export function urgencyLabelRu(key: string | null): string {
  if (key === null) return urgencyLabelsRu.none;
  if (Object.hasOwn(urgencyLabelsRu, key)) return urgencyLabelsRu[key as keyof typeof urgencyLabelsRu];
  throw new RangeError(`unknown urgency key: ${key}`);
}
