"use server";

import { redirect } from "next/navigation";
import { run } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { audit, nid, nowIso } from "@/lib/records";
import type { ActionState } from "@/lib/types";
import { text } from "@/lib/validate";

export async function markAllRead() {
  const user = await getCurrentUser();
  run(
    `update notifications set read_at = ? where tenant_id = ? and user_id = ? and read_at is null`,
    nowIso(),
    user.tenantId,
    user.id,
  );
  redirect("/notifications");
}

export async function updateWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") return { error: "You do not have access to workspace settings." };
  const name = text(formData.get("name"));
  const timezone = text(formData.get("timezone"));
  const currency = text(formData.get("currency"));
  if (!name || !timezone || !currency) return { error: "Name, timezone, and currency are required." };
  const discount = Number(text(formData.get("approvalDiscountPct")) || "10");
  run(
    `update tenants set name = ?, legal_name = ?, industry = ?, website = ?, country = ?, timezone = ?, currency = ?, profile = ?, mfa_required = ?, approval_discount_pct = ? where id = ?`,
    name,
    text(formData.get("legalName")) || name,
    text(formData.get("industry")) || null,
    text(formData.get("website")) || null,
    text(formData.get("country")) || "India",
    timezone,
    currency,
    text(formData.get("profile")) || "combined",
    formData.get("mfaRequired") === "yes" ? 1 : 0,
    Number.isFinite(discount) ? discount : 10,
    user.tenantId,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "settings", recordType: "tenant", recordId: user.tenantId, summary: "Updated workspace settings." });
  redirect("/admin?notice=Settings saved");
}

export async function updatePicklist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") return { error: "You do not have access to workspace settings." };
  const key = text(formData.get("key"));
  const allowed = ["lead_sources", "industries", "lost_reasons", "service_lines", "account_types"];
  if (!allowed.includes(key)) return { error: "That list cannot be edited." };
  const values = text(formData.get("value"))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.length) return { error: "Keep at least one value. Referenced values are deactivated by removal from new choices only after you confirm they are unused." };
  run(
    `insert into settings (tenant_id, key, value) values (?, ?, ?)
     on conflict(tenant_id, key) do update set value = excluded.value`,
    user.tenantId,
    key,
    JSON.stringify(values),
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "settings", recordType: "settings", recordId: key, summary: `Updated ${key}.` });
  redirect("/admin?notice=List updated");
}

export async function saveRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") return { error: "You do not have access to workflow rules." };
  const name = text(formData.get("name"));
  const toStage = text(formData.get("toStage"));
  const subject = text(formData.get("subject"));
  if (!name || !toStage || !subject) return { error: "Name, stage, and task subject are required." };
  run(
    `insert into workflow_rules (id, tenant_id, name, trigger, condition_json, action_type, action_json, active, created_at)
     values (?, ?, ?, 'opportunity.stage', ?, 'create_task', ?, 0, ?)`,
    nid("rule"),
    user.tenantId,
    name,
    JSON.stringify({ toStage }),
    JSON.stringify({ subject, dueInDays: 2 }),
    nowIso(),
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "workflow", recordType: "workflow", recordId: name, summary: `Saved inactive rule ${name}.` });
  redirect("/admin/workflows?notice=Rule saved. It stays inactive until you turn it on.");
}

export async function setRuleActive(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") redirect("/dashboard");
  const id = text(formData.get("id"));
  const active = text(formData.get("active")) === "1" ? 1 : 0;
  run(`update workflow_rules set active = ? where id = ? and tenant_id = ?`, active, id, user.tenantId);
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "workflow",
    recordType: "workflow",
    recordId: id,
    summary: active ? "Activated a workflow rule." : "Paused a workflow rule.",
  });
  redirect("/admin/workflows?notice=Rule updated");
}
