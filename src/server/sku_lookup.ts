import { db } from "../db/client";

export interface SkuLookupScope { org_id: string; supplier_id?: string; code_1c?: string }

function clean(input: string): string {
  return input.trim().replace(/^[\s"'«»“”„]+|[\s"'«»“”„]+$/g, "").trim();
}

function like(input: string): string {
  return input.replace(/[\\%_]/g, "\\$&");
}

// Return the stored 1C code; all queries stay inside the caller's SKU scope.
export function resolveSkuCode(input: string, scope: SkuLookupScope): string | null {
  const value = clean(input);
  if (!value) return null;
  const filter = ` AND (? IS NULL OR supplier_id = ?) AND (? IS NULL OR code_1c = ?)`;
  const params = [scope.supplier_id ?? null, scope.supplier_id ?? null, scope.code_1c ?? null, scope.code_1c ?? null];
  const one = (where: string, term: string) => (db().prepare(`SELECT code_1c FROM sku WHERE ${where}${filter} ORDER BY length(code_1c), code_1c LIMIT 1`)
    .get(term, ...params) as { code_1c: string } | undefined)?.code_1c ?? null;
  const byName = (): string | null => {
    if (value.length < 4) return null;
    const sqlMatch = one("name LIKE ? ESCAPE '\\' COLLATE NOCASE", `%${like(value)}%`);
    if (sqlMatch) return sqlMatch;
    const rows = db().prepare(`SELECT code_1c, name FROM sku WHERE 1=1${filter} ORDER BY length(code_1c), code_1c`)
      .all(...params) as { code_1c: string; name: string }[];
    return rows.find(row => row.name.toLocaleLowerCase("ru").includes(value.toLocaleLowerCase("ru")))?.code_1c ?? null;
  };
  return one("code_1c = ? COLLATE NOCASE", value)
    ?? one("code_1c = ? COLLATE NOCASE", `${value}_`)
    ?? one("code_1c LIKE ? ESCAPE '\\' COLLATE NOCASE", `${like(value)}%`)
    ?? one("article = ? COLLATE NOCASE", value)
    ?? byName();
}
