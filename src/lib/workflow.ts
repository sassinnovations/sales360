import { all, one, run } from "@/db";
import { nid, nowIso, notify } from "./records";

export function runStageRules(input: {
  tenantId: string;
  actorId: string;
  opportunityId: string;
  opportunityName: string;
  ownerId: string | null;
  toStage: string;
}) {
  const rules = all<{
    id: string;
    actionType: string;
    actionJson: string;
    conditionJson: string;
  }>(
    `select id, action_type as actionType, action_json as actionJson, condition_json as conditionJson
     from workflow_rules where tenant_id = ? and active = 1 and trigger = 'opportunity.stage'`,
    input.tenantId,
  );

  for (const rule of rules) {
    const condition = JSON.parse(rule.conditionJson) as { toStage?: string };
    if (condition.toStage && condition.toStage !== input.toStage) continue;
    if (rule.actionType !== "create_task") continue;
    const action = JSON.parse(rule.actionJson) as { subject?: string; dueInDays?: number };
    const existing = one<{ id: string }>(
      `select id from activities where tenant_id = ? and source_rule_id = ? and related_id = ?`,
      input.tenantId,
      rule.id,
      input.opportunityId,
    );
    if (existing) {
      run(
        `insert into workflow_runs (id, tenant_id, rule_id, status, detail, created_at) values (?, ?, ?, 'skipped', ?, ?)`,
        nid("run"),
        input.tenantId,
        rule.id,
        "A task for this rule and opportunity already exists.",
        nowIso(),
      );
      continue;
    }
    const due = new Date();
    due.setDate(due.getDate() + (action.dueInDays ?? 2));
    const taskId = nid("act");
    run(
      `insert into activities (id, tenant_id, type, subject, body, status, priority, due_at, owner_id, related_type, related_id, source_rule_id, created_at, updated_at, version)
       values (?, ?, 'task', ?, ?, 'open', 'Normal', ?, ?, 'opportunity', ?, ?, ?, ?, 1)`,
      taskId,
      input.tenantId,
      action.subject ?? "Workflow task",
      `Created when ${input.opportunityName} moved to ${input.toStage}.`,
      due.toISOString(),
      input.ownerId,
      input.opportunityId,
      rule.id,
      nowIso(),
      nowIso(),
    );
    if (input.ownerId) {
      notify({
        tenantId: input.tenantId,
        userId: input.ownerId,
        title: "Workflow created a task",
        body: action.subject ?? input.opportunityName,
        href: "/activities",
      });
    }
    run(
      `insert into workflow_runs (id, tenant_id, rule_id, status, detail, created_at) values (?, ?, ?, 'success', ?, ?)`,
      nid("run"),
      input.tenantId,
      rule.id,
      `Created task ${taskId} for ${input.opportunityName}.`,
      nowIso(),
    );
  }
}
