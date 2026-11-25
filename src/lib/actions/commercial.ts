"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { one, run, transaction } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canApprove, canWrite } from "@/lib/permissions";
import { audit, changed, nid, notify, nowIso } from "@/lib/records";
import type { ActionState } from "@/lib/types";
import { fieldError, numberValue, text } from "@/lib/validate";

const CONFLICT = "This record was updated by someone else. Refresh and reconcile your changes.";

export async function saveProposal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "proposals")) return { error: "You do not have access to edit proposals." };
  const name = text(formData.get("name"));
  const accountId = text(formData.get("accountId"));
  const discount = numberValue(formData.get("discountPct")) ?? 0;
  const tax = numberValue(formData.get("taxPct")) ?? 18;
  const valid = text(formData.get("validUntil"));
  const descriptions = formData.getAll("description").map((value) => text(value));
  const quantities = formData.getAll("quantity").map((value) => numberValue(value));
  const rates = formData.getAll("rate").map((value) => numberValue(value));
  const fields: Record<string, string> = {};
  if (!name) fieldError(fields, "name", "Proposal name is required.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose an account.");
  if (!valid) fieldError(fields, "validUntil", "Validity date is required.");
  if (discount < 0 || discount > 100) fieldError(fields, "discountPct", "Discount must be between 0 and 100.");
  const lines = descriptions
    .map((description, index) => ({ description, quantity: quantities[index], rate: rates[index] }))
    .filter((line) => line.description);
  if (!lines.length) fieldError(fields, "description", "Add at least one line.");
  lines.forEach((line) => {
    if (line.quantity == null || line.quantity < 0 || line.rate == null || line.rate < 0) {
      fieldError(fields, "quantity", "Quantity and rate must be zero or greater.");
    }
  });
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const needsApproval = discount > user.approvalDiscountPct;
  const requested = text(formData.get("status")) || "Draft";
  const status = requested === "Sent" && needsApproval ? "Internal Review" : requested;
  const now = nowIso();
  const id = text(formData.get("id"));
  const proposalId = id || nid("prop");
  if (id) {
    const current = one<{ status: string }>(`select status from proposals where id = ? and tenant_id = ?`, id, user.tenantId);
    if (!current) return { error: "That proposal is not available." };
    if (current.status === "Approved" || current.status === "Sent" || current.status === "Accepted") {
      return { error: "This version is locked. Create a new proposal for the next revision." };
    }
  }
  try {
  transaction(() => {
    if (id) {
      const ok = changed(
        run(
          `update proposals set name = ?, account_id = ?, opportunity_id = ?, status = ?, valid_until = ?, discount_pct = ?, tax_pct = ?, notes = ?, updated_at = ?, version = version + 1
           where id = ? and tenant_id = ? and version = ?`,
          name,
          accountId,
          text(formData.get("opportunityId")) || null,
          status,
          valid,
          discount,
          tax,
          text(formData.get("notes")) || null,
          now,
          id,
          user.tenantId,
          Number(formData.get("version")),
        ),
      );
      if (!ok) throw new Error("CONFLICT");
      run(`delete from proposal_items where proposal_id = ?`, id);
    } else {
      run(
        `insert into proposals (id, tenant_id, opportunity_id, account_id, name, status, currency, valid_until, discount_pct, tax_pct, owner_id, version_no, notes, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
        proposalId,
        user.tenantId,
        text(formData.get("opportunityId")) || null,
        accountId,
        name,
        status,
        user.currency,
        valid,
        discount,
        tax,
        user.id,
        text(formData.get("notes")) || null,
        now,
        now,
      );
    }
    lines.forEach((line, index) => {
      run(
        `insert into proposal_items (id, proposal_id, description, quantity, rate, position) values (?, ?, ?, ?, ?, ?)`,
        nid("pi"),
        proposalId,
        line.description,
        line.quantity,
        line.rate,
        index + 1,
      );
    });
  });
  } catch {
    return { error: CONFLICT };
  }
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "proposal",
    recordType: "proposal",
    recordId: proposalId,
    summary: needsApproval ? `Saved ${name}. Discount requires approval before send.` : `Saved proposal ${name}.`,
  });
  redirect(`/proposals/${proposalId}?notice=${needsApproval ? "Saved. Approval is required before this can be sent." : "Proposal saved"}`);
}

export async function approveProposal(formData: FormData) {
  const user = await getCurrentUser();
  if (!canApprove(user.role)) redirect("/proposals");
  const id = text(formData.get("id"));
  const ok = changed(
    run(
      `update proposals set status = 'Approved', updated_at = ?, version = version + 1 where id = ? and tenant_id = ? and status = 'Internal Review'`,
      nowIso(),
      id,
      user.tenantId,
    ),
  );
  if (ok) audit({ tenantId: user.tenantId, actorId: user.id, action: "approve", recordType: "proposal", recordId: id, summary: "Approved a proposal for external send." });
  redirect(`/proposals/${id}?notice=${ok ? "Proposal approved" : "This proposal is not waiting for approval"}`);
}

export async function markProposalSent(formData: FormData) {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "proposals")) redirect("/proposals");
  const id = text(formData.get("id"));
  const proposal = one<{ status: string; discountPct: number }>(
    `select status, discount_pct as discountPct from proposals where id = ? and tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!proposal) redirect("/proposals");
  if (proposal.discountPct > user.approvalDiscountPct && proposal.status !== "Approved") {
    redirect(`/proposals/${id}?notice=Approval is required before this proposal can be sent`);
  }
  if (proposal.status !== "Approved" && proposal.status !== "Draft" && proposal.discountPct <= user.approvalDiscountPct) {
    // drafts under the threshold can be sent by the owner of the action
  }
  if (proposal.discountPct > user.approvalDiscountPct && proposal.status !== "Approved") {
    redirect(`/proposals/${id}?notice=Approval is required before this proposal can be sent`);
  }
  const allowed = proposal.status === "Approved" || (proposal.status === "Draft" && proposal.discountPct <= user.approvalDiscountPct) || proposal.status === "Internal Review" && proposal.discountPct <= user.approvalDiscountPct;
  if (!allowed) redirect(`/proposals/${id}?notice=This proposal cannot be sent from its current status`);
  run(`update proposals set status = 'Sent', updated_at = ?, version = version + 1 where id = ? and tenant_id = ?`, nowIso(), id, user.tenantId);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "send", recordType: "proposal", recordId: id, summary: "Marked the proposal as sent." });
  redirect(`/proposals/${id}?notice=Proposal marked sent`);
}

export async function saveContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "contracts")) return { error: "You do not have access to edit contracts." };
  const name = text(formData.get("name"));
  const accountId = text(formData.get("accountId"));
  const start = text(formData.get("startDate"));
  const end = text(formData.get("endDate"));
  const fields: Record<string, string> = {};
  if (!name) fieldError(fields, "name", "Contract name is required.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose an account.");
  if (!start || !end) fieldError(fields, "startDate", "Effective dates are required.");
  if (start && end && end < start) fieldError(fields, "endDate", "End date cannot precede the effective date.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const now = nowIso();
  const id = nid("ctr");
  const lead = Number(text(formData.get("renewalLeadDays")) || "30");
  run(
    `insert into contracts (id, tenant_id, account_id, proposal_id, name, status, start_date, end_date, value, currency, owner_id, renewal_lead_days, notes, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    id,
    user.tenantId,
    accountId,
    text(formData.get("proposalId")) || null,
    name,
    start,
    end,
    numberValue(formData.get("value")),
    user.currency,
    user.id,
    Number.isFinite(lead) ? lead : 30,
    text(formData.get("notes")) || null,
    now,
    now,
  );
  const owner = text(formData.get("ownerId")) || user.id;
  notify({
    tenantId: user.tenantId,
    userId: owner,
    title: "Renewal scheduled",
    body: `${name} will remind you ${lead} days before it ends.`,
    href: "/renewals",
  });
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "contract", recordId: id, summary: `Registered contract ${name}.` });
  redirect("/contracts?notice=Contract registered");
}

export async function saveCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "cases")) return { error: "You do not have access to edit cases." };
  const subject = text(formData.get("subject"));
  const accountId = text(formData.get("accountId"));
  const description = text(formData.get("description"));
  const priority = text(formData.get("priority"));
  const fields: Record<string, string> = {};
  if (!subject) fieldError(fields, "subject", "Subject is required.");
  if (!description) fieldError(fields, "description", "Description is required.");
  if (!priority) fieldError(fields, "priority", "Priority is required.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose an account.");
  const status = text(formData.get("status")) || "New";
  if (status === "Closed" && !text(formData.get("resolution"))) fieldError(fields, "resolution", "Closed cases need a resolution.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const hours = priority === "High" ? 8 : priority === "Low" ? 72 : 24;
  const sla = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const now = nowIso();
  const id = text(formData.get("id")) || nid("case");
  if (text(formData.get("id"))) {
    const ok = changed(
      run(
        `update cases set subject = ?, description = ?, category = ?, priority = ?, owner_id = ?, status = ?, resolution = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        subject,
        description,
        text(formData.get("category")) || null,
        priority,
        text(formData.get("ownerId")) || user.id,
        status,
        text(formData.get("resolution")) || null,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
  } else {
    run(
      `insert into cases (id, tenant_id, account_id, contact_id, subject, description, category, priority, owner_id, status, sla_due_at, resolution, created_at, updated_at, version)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      id,
      user.tenantId,
      accountId,
      text(formData.get("contactId")) || null,
      subject,
      description,
      text(formData.get("category")) || null,
      priority,
      text(formData.get("ownerId")) || user.id,
      status,
      sla,
      text(formData.get("resolution")) || null,
      now,
      now,
    );
  }
  const note = text(formData.get("note"));
  if (note) {
    run(
      `insert into case_notes (id, case_id, author_id, body, visibility, created_at) values (?, ?, ?, ?, ?, ?)`,
      nid("cn"),
      id,
      user.id,
      note,
      text(formData.get("visibility")) === "customer" ? "customer" : "internal",
      now,
    );
  }
  audit({ tenantId: user.tenantId, actorId: user.id, action: "case", recordType: "case", recordId: id, summary: `Case ${subject} is ${status}.` });
  redirect(`/cases/${id}?notice=Case saved`);
}

export async function saveCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "campaigns")) return { error: "You do not have access to edit campaigns." };
  const name = text(formData.get("name"));
  const start = text(formData.get("startDate"));
  const end = text(formData.get("endDate"));
  const fields: Record<string, string> = {};
  if (!name) fieldError(fields, "name", "Campaign name is required.");
  if (start && end && end < start) fieldError(fields, "endDate", "End date cannot precede the start date.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const id = nid("camp");
  const now = nowIso();
  run(
    `insert into campaigns (id, tenant_id, name, objective, type, owner_id, start_date, end_date, budget, status, attribution, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'First touch', ?, ?, 1)`,
    id,
    user.tenantId,
    name,
    text(formData.get("objective")) || null,
    text(formData.get("type")) || "Email",
    user.id,
    start || null,
    end || null,
    numberValue(formData.get("budget")),
    now,
    now,
  );
  const contacts = formData.getAll("contactId").map((value) => text(value)).filter(Boolean);
  for (const contactId of contacts) {
    const contact = one<{ consent: string }>(
      `select consent from contacts where id = ? and tenant_id = ?`,
      contactId,
      user.tenantId,
    );
    if (!contact) continue;

    run(
      `insert into campaign_members
       (id, campaign_id, contact_id, status, stage)
       values (?, ?, ?, ?, ?)`,
      nid("cm"),
      id,
      contactId,
      contact.consent === "opted_out" ? "Suppressed" : "Ready",
      contact.consent === "opted_out" ? "Suppressed" : "New",
    );
  }
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "campaign", recordId: id, summary: `Created campaign ${name}.` });
  redirect(`/campaigns/${id}?notice=Campaign saved. Opted-out contacts are suppressed.`);
}
export async function updateCampaignMemberStage(formData: FormData): Promise<void> {
  const user = await getCurrentUser();

  if (!canWrite(user.role, "campaigns")) {
    return;
  }

  const memberId = text(formData.get("memberId"));
  const stage = text(formData.get("stage"));

  if (!memberId || !["New", "Suppressed"].includes(stage)) {
    return;
  }

  const member = one<{ id: string; campaignId: string }>(
    `select id, campaign_id as campaignId
     from campaign_members
     where id = ?`,
    memberId,
  );

  if (!member) {
    return;
  }

  const campaign = one<{ id: string }>(
    `select id
     from campaigns
     where id = ? and tenant_id = ?`,
    member.campaignId,
    user.tenantId,
  );

  if (!campaign) {
    return;
  }

  run(
    `update campaign_members
     set stage = ?
     where id = ?`,
    stage,
    memberId,
  );

  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "stage",
    recordType: "campaign_member",
    recordId: memberId,
    summary: `Campaign member moved to ${stage}.`,
  });
}

export async function updateRenewalStatus(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();

  if (!canWrite(user.role, "contracts")) {
    return;
  }

  const contractId = text(formData.get("contractId"));
  const renewalStatus = text(formData.get("renewalStatus"));

  const allowedStatuses = [
    "Not Started",
    "In Discussion",
    "Renewed",
    "Not Renewing",
  ];

  if (!contractId || !allowedStatuses.includes(renewalStatus)) {
    return;
  }

  const contract = one<{ id: string }>(
    `select id
     from contracts
     where id = ? and tenant_id = ?`,
    contractId,
    user.tenantId,
  );

  if (!contract) {
    return;
  }

  run(
    `update contracts
     set renewal_status = ?, updated_at = ?, version = version + 1
     where id = ? and tenant_id = ?`,
    renewalStatus,
    nowIso(),
    contractId,
    user.tenantId,
  );

  revalidatePath("/renewals");

  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "renewal_status",
    recordType: "contract",
    recordId: contractId,
    summary: "Renewal status changed to " + renewalStatus + ".",
  });
}
