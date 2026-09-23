import { resolve } from "node:path";

export function databasePath() {
  const configured = process.env.DATABASE_PATH || "./data/ainalym.db";
  return configured === ":memory:" ? configured : resolve(configured);
}
