import { randomBytes, randomUUID } from "crypto";
import { run } from "@/db";

export function nowIso() {
  return new Date().toISOString();
}

export function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function nid(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function token() {
  return randomBytes(24).toString("hex");
}

export function audit(input: {
  tenantId: string;
  actorId?: string | null;
  action: string;
  recordType?: string | null;
  recordId?: string | null;
  summary: string;
}) {
  run(
    `insert into audit_events (id, tenant_id, actor_id, action, record_type, record_id, summary, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    nid("aud"),
    input.tenantId,
    input.actorId ?? null,
    input.action,
    input.recordType ?? null,
    input.recordId ?? null,
    input.summary,
    nowIso(),
  );
}

export function notify(input: {
  tenantId: string;
  userId: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  run(
    `insert into notifications (id, tenant_id, user_id, title, body, href, created_at)
     values (?, ?, ?, ?, ?, ?, ?)`,
    nid("ntf"),
    input.tenantId,
    input.userId,
    input.title,
    input.body ?? null,
    input.href ?? null,
    nowIso(),
  );
}

export function changed(result: { changes: number | bigint }) {
  return Number(result.changes) > 0;
}
