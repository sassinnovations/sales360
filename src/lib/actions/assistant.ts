"use server";

import { revalidatePath } from "next/cache";
import { all, one, run } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canSeeCandidateRates } from "@/lib/permissions";
import { money } from "@/lib/format";
import { audit, nid, nowIso } from "@/lib/records";
import type { AssistantReply } from "@/lib/types";

export async function askAssistant(question: string): Promise<AssistantReply> {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "assistant")) {
    return { kind: "unknown", text: "The assistant is not available for your role.", sources: [] };
  }
  const q = question.trim();
  if (!q) return { kind: "unknown", text: "Ask about a record, your tasks, or the pipeline.", sources: [] };
  if (q.length > 500) return { kind: "unknown", text: "That question is too long to answer safely.", sources: [] };
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "ai_query",
    recordType: "assistant",
    recordId: user.id,
    summary: `Asked: ${q.slice(0, 140)}`,
  });
  const lower = q.toLowerCase();
  if (/candidate|resume|compensation|pay rate/.test(lower) && !canAccess(user.role, "candidates")) {
    return {
      kind: "answer",
      text: "I can't answer that from candidate records. Your role does not include them, so I won't guess.",
      sources: [],
    };
  }

  if (/overdue|due today|my tasks|tasks/.test(lower)) {
    const rows = all<{ id: string; subject: string; dueAt: string; status: string }>(
      `select id, subject, due_at, status from activities where tenant_id = ? and owner_id = ? and type = 'task' and status = 'open' order by due_at limit 6`,
      user.tenantId,
      user.id,
    );
    if (!rows.length) return { kind: "answer", text: "You have no open tasks in this workspace.", sources: [{ href: "/activities", label: "Tasks" }] };
    return {
      kind: "answer",
      text: `Open tasks:\n${rows.map((row) => `• ${row.subject} — due ${row.dueAt.slice(0, 10)}`).join("\n")}`,
      sources: [{ href: "/activities", label: "Open tasks" }],
    };
  }

  if (/pipeline|forecast|weighted/.test(lower)) {
    if (!canAccess(user.role, "opportunities")) {
      return { kind: "answer", text: "I can't summarize pipeline data for your role.", sources: [] };
    }
    const owner = user.role === "bdm" ? "and owner_id = ?" : "";
    const params = user.role === "bdm" ? [user.tenantId, user.id] : [user.tenantId];
    const row = one<{ total: number; count: number }>(
      `select coalesce(sum(amount * probability / 100.0), 0) as total, count(*) as count
       from opportunities where tenant_id = ? ${owner} and status = 'open'`,
      ...params,
    );
    return {
      kind: "answer",
      text: `Open pipeline you can see: ${row?.count ?? 0} opportunities. Weighted value is ${money(Number(row?.total ?? 0), user.currency)}. Weighted value is amount × stage probability. This is a calculation, not a forecast commitment.`,
      sources: [{ href: "/pipeline", label: "Pipeline" }, { href: "/reports", label: "Definitions" }],
    };
  }

  const draft = lower.match(/draft (?:an |a )?(?:email|follow-up|follow up)(?: to| for)?\s+(.+)/);
  if (draft) {
    const name = draft[1].replace(/[?.]/g, "").trim();
    const contact = one<{ id: string; name: string; title: string | null; email: string | null; consent: string; accountName: string | null }>(
      `select c.id, c.name, c.title, c.email, c.consent, a.name as account_name
       from contacts c left join accounts a on a.id = c.account_id
       where c.tenant_id = ? and lower(c.name) like ?`,
      user.tenantId,
      `%${name.toLowerCase()}%`,
    );
    if (!contact) {
      return { kind: "unknown", text: `I couldn't find a contact matching “${name}” that you can use.`, sources: [] };
    }
    if (contact.consent === "opted_out") {
      return {
        kind: "answer",
        text: `${contact.name} is opted out. I won't draft an outreach email.`,
        sources: [{ href: `/contacts/${contact.id}`, label: contact.name }],
      };
    }
    return {
      kind: "draft",
      text: "Draft only. Nothing is sent, and this local workspace does not connect to a mailbox. You can edit the text, then record it on the timeline.",
      sources: [{ href: `/contacts/${contact.id}`, label: contact.name }],
      draft: {
        subject: `Follow-up for ${contact.accountName ?? contact.name}`,
        body: `Hello ${contact.name.split(" ")[0]},\n\nI'm following up on our conversation${contact.accountName ? ` with ${contact.accountName}` : ""}. I don't have a new commercial commitment to add here — tell me if you want a time to review the current scope.\n\n${user.name}`,
        relatedType: "contact",
        relatedId: contact.id,
      },
    };
  }

  if (/summarize|summary|brief/.test(lower)) {
    const account = all<{ id: string; name: string; health: string | null; healthReason: string | null }>(
      `select id, name, health, health_reason from accounts where tenant_id = ?`,
      user.tenantId,
    ).find((item) => lower.includes(item.name.toLowerCase()));
    if (!account) {
      return {
        kind: "unknown",
        text: "Name the account you want summarized, for example “Summarize Lumen Health”. I won't invent a brief without a record.",
        sources: [],
      };
    }
    const opps = canAccess(user.role, "opportunities")
      ? all<{ name: string; amount: number; currency: string; status: string }>(
          `select name, amount, currency, status from opportunities where tenant_id = ? and account_id = ?`,
          user.tenantId,
          account.id,
        )
      : [];
    const open = opps.filter((opp) => opp.status === "open");
    const lines = [
      `${account.name} health is ${account.health ?? "not set"}.`,
      account.healthReason ? `Reason on the record: ${account.healthReason}` : "No health reason is stored.",
      open.length
        ? `Open opportunities: ${open.map((opp) => `${opp.name} (${money(opp.amount, opp.currency)})`).join("; ")}.`
        : "No open opportunities are visible to you on this account.",
    ];
    return {
      kind: "answer",
      text: lines.join("\n"),
      sources: [{ href: `/accounts/${account.id}`, label: account.name }],
    };
  }

  if (/who should i call|hot lead|priorit/.test(lower) && canAccess(user.role, "leads")) {
    const owner = user.role === "bdm" ? "and owner_id = ?" : "";
    const params = user.role === "bdm" ? [user.tenantId, user.id] : [user.tenantId];
    const leads = all<{ id: string; name: string | null; company: string | null; score: number; scoreReasons: string | null }>(
      `select id, name, company, score, score_reasons from leads
       where tenant_id = ? ${owner} and status in ('New','Working','Qualified')
       order by score desc limit 3`,
      ...params,
    );
    if (!leads.length) return { kind: "answer", text: "No open leads are in your scope.", sources: [{ href: "/leads", label: "Leads" }] };
    return {
      kind: "answer",
      text: leads
        .map((lead) => {
          const reasons = lead.scoreReasons ? (JSON.parse(lead.scoreReasons) as string[]).slice(0, 2).join("; ") : "No explanation stored";
          return `• ${lead.name ?? lead.company} — score ${lead.score}. ${reasons}.`;
        })
        .join("\n"),
      sources: leads.map((lead) => ({ href: `/leads/${lead.id}`, label: lead.name || lead.company || "Lead" })),
    };
  }

  if (/requirement|staffing|submission/.test(lower) && canAccess(user.role, "requirements")) {
    const rows = all<{ id: string; title: string; status: string; accountName: string }>(
      `select r.id, r.title, r.status, a.name as account_name from requirements r join accounts a on a.id = r.account_id
       where r.tenant_id = ? and r.status not in ('Filled','Cancelled') order by r.updated_at desc limit 5`,
      user.tenantId,
    );
    const rateNote = canSeeCandidateRates(user.role) ? "" : " Rates are hidden for your role.";
    return {
      kind: "answer",
      text: rows.length
        ? `Open requirements:${rateNote}\n${rows.map((row) => `• ${row.title} at ${row.accountName} — ${row.status}`).join("\n")}`
        : "No open requirements are in this workspace.",
      sources: rows.map((row) => ({ href: `/requirements/${row.id}`, label: row.title })),
    };
  }

  return {
    kind: "unknown",
    text: "I don't have a grounded answer for that. Try “my tasks”, “pipeline”, “summarize Lumen Health”, “hot leads”, or “draft a follow-up to Helen Cho”.",
    sources: [],
  };
}

export async function recordDraft(formData: FormData) {
  const user = await getCurrentUser();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const relatedType = String(formData.get("relatedType") ?? "");
  const relatedId = String(formData.get("relatedId") ?? "");
  if (!subject || !body) return;
  if (formData.get("confirm") !== "yes") return;
  const id = nid("act");
  const now = nowIso();
  run(
    `insert into activities (id, tenant_id, type, subject, body, status, priority, due_at, owner_id, related_type, related_id, outcome, created_at, updated_at, version)
     values (?, ?, 'email', ?, ?, 'completed', 'Normal', ?, ?, ?, ?, 'Recorded by user. Not delivered to an external mailbox.', ?, ?, 1)`,
    id,
    user.tenantId,
    subject,
    body,
    now,
    user.id,
    relatedType || null,
    relatedId || null,
    now,
    now,
  );
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "ai_accept",
    recordType: relatedType || "activity",
    recordId: relatedId || id,
    summary: "User recorded an AI draft on the timeline. No external email was sent.",
  });
  revalidatePath("/activities");
}

export async function saveScoreFeedback(formData: FormData) {
  const user = await getCurrentUser();
  run(
    `insert into ai_feedback (id, tenant_id, user_id, record_type, record_id, useful, reason, created_at)
     values (?, ?, ?, 'lead', ?, ?, ?, ?)`,
    nid("fb"),
    user.tenantId,
    user.id,
    String(formData.get("id") ?? ""),
    formData.get("useful") === "yes" ? 1 : 0,
    String(formData.get("reason") ?? ""),
    nowIso(),
  );
}
