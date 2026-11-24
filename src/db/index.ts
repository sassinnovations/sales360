import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { SCHEMA } from "./schema";
import { seedIfEmpty } from "./seed";

type SqlValue = string | number | null | bigint;

const globalForDb = globalThis as unknown as {
  sales360?: DatabaseSync;
  sales360LeadColumns?: boolean;
  sales360ContactColumns?: boolean;
  sales360OpportunityColumns?: boolean;
  sales360AccountColumns?: boolean;
  sales360RequirementColumns?: boolean;
};

function openDatabase() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "sales360.db"));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

function ensureLeadColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("pragma table_info(leads)").all() as { name: string }[]).map((column) => column.name),
  );
  for (const name of ["first_name", "last_name", "linkedin_url", "city", "state", "country"]) {
    if (!columns.has(name)) db.exec(`alter table leads add column ${name} text`);
  }
  const rows = db.prepare("select id, name, first_name, last_name from leads").all() as {
    id: string;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  }[];
  const fill = db.prepare("update leads set first_name = ?, last_name = ? where id = ?");
  for (const row of rows) {
    if (row.first_name || row.last_name || !row.name) continue;
    const parts = row.name.trim().split(/\s+/);
    fill.run(parts[0] ?? "", parts.slice(1).join(" "), row.id);
  }
}
function ensureContactColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("pragma table_info(contacts)").all() as { name: string }[]).map((column) => column.name),
  );

  for (const name of ["city", "state", "country"]) {
    if (!columns.has(name)) {
      db.exec(`alter table contacts add column ${name} text`);
    }
  }
}
function ensureOpportunityColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("pragma table_info(opportunities)").all() as { name: string }[]).map((column) => column.name),
  );

  if (!columns.has("customer_type")) {
    db.exec("alter table opportunities add column customer_type text");
  }
}
function ensureAccountColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare("pragma table_info(accounts)").all() as { name: string }[]).map(
      (column) => column.name,
    ),
  );

  const migrations: [string, string][] = [
    ["city", "text"],
    ["state", "text"],
    ["annual_revenue", "real"],
    ["linkedin_url", "text"],
    ["account_status", "text not null default 'New'"],
  ];

  for (const [name, definition] of migrations) {
    if (!columns.has(name)) {
      db.exec(`alter table accounts add column ${name} ${definition}`);
    }
  }
}

function ensureRequirementColumns(db: DatabaseSync) {
  const columns = new Set(
    (
      db.prepare("PRAGMA table_info(requirements)").all() as {
        name: string;
      }[]
    ).map((column) => column.name),
  );

  const newColumns = [
    "category",
    "work_authorization",
    "requirement_date",
  ];

  for (const name of newColumns) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE requirements ADD COLUMN ${name} TEXT`);
    }
  }
}

export function getDb() {
  if (!globalForDb.sales360) {
    globalForDb.sales360 = openDatabase();
    seedIfEmpty(globalForDb.sales360);
  }

  if (!globalForDb.sales360LeadColumns) {
    ensureLeadColumns(globalForDb.sales360);
    globalForDb.sales360LeadColumns = true;
  }
  if (!globalForDb.sales360ContactColumns) {
    ensureContactColumns(globalForDb.sales360);
    globalForDb.sales360ContactColumns = true;
  }

  if (!globalForDb.sales360OpportunityColumns) {
    ensureOpportunityColumns(globalForDb.sales360);
    globalForDb.sales360OpportunityColumns = true;
  }

  if (!globalForDb.sales360AccountColumns) {
    ensureAccountColumns(globalForDb.sales360);
    globalForDb.sales360AccountColumns = true;
  }

  if (!globalForDb.sales360RequirementColumns) {
    ensureRequirementColumns(globalForDb.sales360);
    globalForDb.sales360RequirementColumns = true;
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
