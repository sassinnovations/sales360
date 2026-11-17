import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { SCHEMA } from "./schema";
import { seedIfEmpty } from "./seed";

type SqlValue = string | number | null | bigint;

const globalForDb = globalThis as unknown as { sales360?: DatabaseSync };

function openDatabase() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "sales360.db"));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function getDb() {
  if (!globalForDb.sales360) {
    globalForDb.sales360 = openDatabase();
    seedIfEmpty(globalForDb.sales360);
  }
  return globalForDb.sales360;
}

export function mapRow<T>(row: Record<string, unknown> | undefined | null): T | undefined {
  if (!row) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    out[camel] = typeof value === "bigint" ? Number(value) : value;
  }
  return out as T;
}

export function all<T = Record<string, unknown>>(sql: string, ...params: SqlValue[]): T[] {
  const rows = getDb().prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((row) => mapRow<T>(row)!);
}

export function one<T>(sql: string, ...params: SqlValue[]): T | undefined {
  const row = getDb().prepare(sql).get(...params) as Record<string, unknown> | undefined;
  return mapRow<T>(row);
}

export function run(sql: string, ...params: SqlValue[]) {
  return getDb().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
