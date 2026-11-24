"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, run, transaction } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { findDuplicateLead, getLead, settingList } from "@/lib/queries";
import { audit, changed, nid, notify, nowIso } from "@/lib/records";
import { scoreLead } from "@/lib/score";
import type { ActionState } from "@/lib/types";
import { fieldError, isEmail, isPhone, isWebsite, numberValue, text } from "@/lib/validate";
import { runStageRules } from "@/lib/workflow";

const CONFLICT = "This record was updated by someone else. Refresh and reconcile your changes.";

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

export async function saveLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "leads")) return { error: "You do not have access to edit leads." };
  const id = text(formData.get("id"));
  const firstName = text(formData.get("firstName"));
  const lastName = text(formData.get("lastName"));
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const company = text(formData.get("company"));
  const email = text(formData.get("email"));
  const phone = text(formData.get("phone"));
  const linkedinUrl = text(formData.get("linkedinUrl"));
  const city = text(formData.get("city"));
  const region = text(formData.get("state"));
  const country = text(formData.get("country"));
  const source = text(formData.get("source"));
  const status = text(formData.get("status")) || "New";
  const title = text(formData.get("title"));
  const ownerId = text(formData.get("ownerId")) || user.id;
  const notes = text(formData.get("notes"));
  const fields: Record<string, string> = {};
  if (!firstName) fieldError(fields, "firstName", "Enter a first name.");
  if (!lastName) fieldError(fields, "lastName", "Enter a last name.");
  if (!email && !phone) fieldError(fields, "email", "Add an email or a mobile number.");
  if (email && !isEmail(email)) fieldError(fields, "email", "Enter a valid email address.");
  if (phone && !isPhone(phone)) fieldError(fields, "phone", "Enter a valid mobile number.");
  if (linkedinUrl && !isWebsite(linkedinUrl)) fieldError(fields, "linkedinUrl", "Enter a valid LinkedIn URL.");
  const sources = settingList(user.tenantId, "lead_sources", []);
  const statuses = ["New", "Working", "Qualified", "Unqualified", "Archived"];
  if (source && !sources.includes(source)) fieldError(fields, "source", "Choose a configured source.");
  if (!statuses.includes(status)) fieldError(fields, "status", "Choose a valid status.");
  const owner = one(`select id from users where id = ? and tenant_id = ? and status = 'active'`, ownerId, user.tenantId);
  if (!owner) fieldError(fields, "ownerId", "Choose an owner in this workspace.");
  if (Object.keys(fields).length) return { fieldErrors: fields };

  const duplicate = findDuplicateLead(user.tenantId, email, phone, id || undefined);
  if (duplicate && text(formData.get("confirmDuplicate")) !== "yes") {
    return {
      warning: `Possible duplicate of ${duplicate.name || "an existing lead"}${duplicate.company ? ` at ${duplicate.company}` : ""}.`,
      duplicateId: duplicate.id,
    };
  }
  const last = one<{ dueAt: string | null }>(
    `select max(created_at) as dueAt from activities where tenant_id = ? and related_type = 'lead' and related_id = ?`,
    user.tenantId,
    id || "",
  );
  const scored = scoreLead({ email, phone, company, title, status, source, daysSinceActivity: daysSince(last?.dueAt) });
  const now = nowIso();
  if (id) {
    const existing = getLead(user, id);
    if (!existing || existing.status === "Converted") return { error: "That lead is not available to edit." };
    const ok = changed(
      run(
        `update leads set name = ?, first_name = ?, last_name = ?, company = ?, title = ?, email = ?, phone = ?, linkedin_url = ?, city = ?, state = ?, country = ?, source = ?, status = ?, owner_id = ?, notes = ?, score = ?, score_reasons = ?, score_updated_at = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        name || null,
        firstName || null,
        lastName || null,
        company || null,
        title || null,
        email || null,
        phone || null,
        linkedinUrl || null,
        city || null,
        region || null,
        country || null,
        source || null,
        status,
        ownerId,
        notes || null,
        scored.score,
        JSON.stringify(scored.reasons),
        now,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "lead", recordId: id, summary: `Updated lead ${name || company}.` });
    revalidatePath("/leads");
    redirect(`/leads/${id}?notice=Lead saved`);
  }
  const leadId = nid("ld");
  run(
    `insert into leads (id, tenant_id, name, first_name, last_name, company, title, email, phone, linkedin_url, city, state, country, source, status, owner_id, score, score_reasons, score_updated_at, notes, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    leadId,
    user.tenantId,
    name || null,
    firstName || null,
    lastName || null,
    company || null,
    title || null,
    email || null,
    phone || null,
    linkedinUrl || null,
    city || null,
    region || null,
    country || null,
    source || null,
    status,
    ownerId,
    scored.score,
    JSON.stringify(scored.reasons),
    now,
    notes || null,
    now,
    now,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "lead", recordId: leadId, summary: `Created lead ${name || company}.` });
  if (ownerId !== user.id) {
    notify({ tenantId: user.tenantId, userId: ownerId, title: "Lead assigned", body: name || company, href: `/leads/${leadId}` });
  }
  revalidatePath("/leads");
  redirect(`/leads/${leadId}?notice=Lead created`);
}

export async function convertLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "leads")) return { error: "You do not have access to convert leads." };
  const id = text(formData.get("id"));
  const lead = getLead(user, id);
  if (!lead) return { error: "That lead is not available." };
  if (lead.convertedAt) return { error: "This lead is already converted." };
  const fields: Record<string, string> = {};
  const need = text(formData.get("need"));
  const budget = text(formData.get("budget"));
  const authority = text(formData.get("authority"));
  const timelineNote = text(formData.get("timelineNote"));
  const fit = text(formData.get("fit"));
  const service = text(formData.get("serviceInterest"));
  if (!need) fieldError(fields, "need", "Describe the need.");
  if (!timelineNote) fieldError(fields, "timelineNote", "Add the expected timeline.");
  const mode = text(formData.get("accountMode"));
  const existingAccount = text(formData.get("accountId"));
  const accountName = text(formData.get("accountName")) || String(lead.company ?? "");
  if (mode === "existing") {
    const account = one(`select id from accounts where id = ? and tenant_id = ?`, existingAccount, user.tenantId);
    if (!account) fieldError(fields, "accountId", "Choose an account in this workspace.");
  } else if (!accountName) {
    fieldError(fields, "accountName", "Account name is required.");
  }
  const createOpportunity = formData.get("createOpportunity") === "yes";
  const oppName = text(formData.get("opportunityName"));
  const amount = numberValue(formData.get("amount"));
  const closeDate = text(formData.get("closeDate"));
  if (createOpportunity) {
    if (!oppName) fieldError(fields, "opportunityName", "Opportunity name is required.");
    if (amount == null || Number.isNaN(amount) || amount < 0) fieldError(fields, "amount", "Enter a non-negative amount.");
    if (!closeDate) fieldError(fields, "closeDate", "Expected close date is required.");
  }
  if (Object.keys(fields).length) return { fieldErrors: fields };

  let destination = "";
  try {
    destination = transaction(() => {
      const current = one<{ convertedAt: string | null }>(
        `select converted_at as convertedAt from leads where id = ? and tenant_id = ?`,
        id,
        user.tenantId,
      );
      if (!current || current.convertedAt) throw new Error("ALREADY");
      const now = nowIso();
      let accountId = existingAccount;
      if (mode !== "existing") {
        accountId = nid("acc");
        run(
          `insert into accounts (id, tenant_id, name, type, industry, owner_id, status, health, health_reason, created_at, updated_at, version)
           values (?, ?, ?, 'Prospect', ?, ?, 'Active', 'Watch', 'Created from a converted lead.', ?, ?, 1)`,
          accountId,
          user.tenantId,
          accountName,
          null,
          user.id,
          now,
          now,
        );
      }
      const contactId = nid("con");
      run(
        `insert into contacts (id, tenant_id, account_id, name, title, email, phone, consent, is_primary, owner_id, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, 'unknown', 0, ?, ?, ?, 1)`,
        contactId,
        user.tenantId,
        accountId,
        String(lead.name || accountName),
        (lead.title as string) || null,
        (lead.email as string) || null,
        (lead.phone as string) || null,
        user.id,
        now,
        now,
      );
      run(`insert into contact_accounts (contact_id, account_id) values (?, ?)`, contactId, accountId);
      let opportunityId: string | null = null;
      if (createOpportunity) {
        const stage = one<{ id: string; name: string; probability: number }>(
          `select id, name, probability from stages where tenant_id = ? and kind = 'open' order by sort_order limit 1`,
          user.tenantId,
        );
        if (!stage) throw new Error("NO_STAGE");
        opportunityId = nid("opp");
        const pipeline = one<{ id: string }>(`select id from pipelines where tenant_id = ? and is_default = 1`, user.tenantId);
        run(
          `insert into opportunities (id, tenant_id, name, account_id, contact_id, owner_id, source, pipeline_id, stage_id, amount, currency, probability, close_date, service_line, customer_type, status, created_at, updated_at, version)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, 1)`,
          opportunityId,
          user.tenantId,
          oppName,
          accountId,
          contactId,
          user.id,
          (lead.source as string) || null,
          pipeline?.id ?? null,
          stage.id,
          amount,
          user.currency,
          stage.probability,
          new Date(closeDate).toISOString(),
          service || null,
          now,
          now,
        );
        run(
          `insert into stage_history (id, tenant_id, opportunity_id, from_stage, to_stage, actor_id, created_at) values (?, ?, ?, null, ?, ?, ?)`,
          nid("hist"),
          user.tenantId,
          opportunityId,
          stage.name,
          user.id,
          now,
        );
      }
      const updated = run(
        `update leads set status = 'Converted', converted_at = ?, account_id = ?, contact_id = ?, opportunity_id = ?, need = ?, budget = ?, authority = ?, timeline_note = ?, fit = ?, service_interest = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and converted_at is null`,
        now,
        accountId,
        contactId,
        opportunityId,
        need,
        budget || null,
        authority || null,
        timelineNote,
        fit || null,
        service || null,
        now,
        id,
        user.tenantId,
      );
      if (!changed(updated)) throw new Error("ALREADY");
      audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: "convert",
        recordType: "lead",
        recordId: id,
        summary: `Converted lead into account ${accountId}${opportunityId ? ` and opportunity ${opportunityId}` : ""}.`,
      });
      return opportunityId ? `/opportunities/${opportunityId}` : `/accounts/${accountId}`;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ALREADY") return { error: "This lead is already converted." };
    return { error: "Conversion did not finish. The lead was left unchanged." };
  }
  revalidatePath("/leads");
  redirect(`${destination}?notice=Lead converted`);
}

export async function saveAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "accounts")) return { error: "You do not have access to edit accounts." };

  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const website = text(formData.get("website"));
  const linkedinUrl = text(formData.get("linkedinUrl"));
  const parentId = text(formData.get("parentId"));

  const country = text(formData.get("country"));
  const state = text(formData.get("state"));
  const city = text(formData.get("city"));
  const annualRevenue = numberValue(formData.get("annualRevenue"));
  const accountStatus = text(formData.get("accountStatus")) || "New";

  const fields: Record<string, string> = {};

  if (!name) fieldError(fields, "name", "Account name is required.");
  if (website && !isWebsite(website)) fieldError(fields, "website", "Enter a valid website.");
  if (linkedinUrl && !isWebsite(linkedinUrl)) fieldError(fields, "linkedinUrl", "Enter a valid LinkedIn URL.");
  if (annualRevenue !== null && (!Number.isFinite(annualRevenue) || annualRevenue < 0)) {
    fieldError(fields, "annualRevenue", "Enter a valid non-negative annual revenue.");
  }

  if (parentId && parentId === id) fieldError(fields, "parentId", "An account cannot be its own parent.");
  if (parentId && createsCycle(user.tenantId, id, parentId)) {
    fieldError(fields, "parentId", "That parent would create a circular hierarchy.");
  }

  const types = settingList(user.tenantId, "account_types", ["Prospect", "Customer", "Partner"]);
  const type = text(formData.get("type"));

  if (type && !types.includes(type)) fieldError(fields, "type", "Choose a configured account type.");

  const accountStatuses = ["New", "Prospecting", "Qualification", "Negotiation", "Closed Won", "Closed Lost"];
  if (!accountStatuses.includes(accountStatus)) {
    fieldError(fields, "accountStatus", "Choose a valid account status.");
  }

  if (Object.keys(fields).length) return { fieldErrors: fields };

  const now = nowIso();

  const values = [
    name,
    type || "Prospect",
    text(formData.get("industry")) || null,
    website || null,
    text(formData.get("region")) || null,
    country || null,
    city || null,
    state || null,
    annualRevenue,
    linkedinUrl || null,
    accountStatus,
    text(formData.get("ownerId")) || user.id,
    text(formData.get("status")) || "Active",
    text(formData.get("health")) || "Watch",
    text(formData.get("healthReason")) || null,
    parentId || null,
    text(formData.get("phone")) || null,
    now,
  ];

  if (id) {
    const ok = changed(
      run(
        `update accounts set
          name = ?, type = ?, industry = ?, website = ?, region = ?, country = ?,
          city = ?, state = ?, annual_revenue = ?, linkedin_url = ?, account_status = ?,
          owner_id = ?, status = ?, health = ?, health_reason = ?, parent_id = ?,
          phone = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        ...values,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );

    if (!ok) return { error: CONFLICT };

    audit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: "update",
      recordType: "account",
      recordId: id,
      summary: `Updated account ${name}.`,
    });

    redirect(`/accounts/${id}?notice=Account saved`);
  }

  const accountId = nid("acc");

  run(
    `insert into accounts (
      id, tenant_id, name, type, industry, website, region, country,
      city, state, annual_revenue, linkedin_url, account_status,
      owner_id, status, health, health_reason, parent_id, phone,
      created_at, updated_at, version
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    accountId,
    user.tenantId,
    ...values,
    now,
  );

  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "create",
    recordType: "account",
    recordId: accountId,
    summary: `Created account ${name}.`,
  });

  redirect(`/accounts/${accountId}?notice=Account created`);
}

function createsCycle(tenantId: string, id: string, parentId: string) {
  let current: string | null = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id || seen.has(current)) return true;
    seen.add(current);
    const found: { parentId: string | null } | undefined = one(
      `select parent_id as parentId from accounts where id = ? and tenant_id = ?`,
      current,
      tenantId,
    );
    current = found?.parentId ?? null;
  }
  return false;
}

export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "contacts")) return { error: "You do not have access to edit contacts." };
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const email = text(formData.get("email"));
  const phone = text(formData.get("phone"));
  const accountId = text(formData.get("accountId"));
  const fields: Record<string, string> = {};
  if (!name) fieldError(fields, "name", "Contact name is required.");
  if (!email && !phone) fieldError(fields, "email", "Add an email or a phone number.");
  if (email && !isEmail(email)) fieldError(fields, "email", "Enter a valid email address.");
  if (phone && !isPhone(phone)) fieldError(fields, "phone", "Enter a valid phone number.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose an account in this workspace.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  if (email) {
    const dup = one<{ id: string; name: string }>(
      `select id, name from contacts where tenant_id = ? and lower(email) = lower(?) and id != ?`,
      user.tenantId,
      email,
      id || "",
    );
    if (dup && text(formData.get("confirmDuplicate")) !== "yes") {
      return { warning: `Possible duplicate of ${dup.name}.`, duplicateId: dup.id };
    }
  }
  const primary = formData.get("isPrimary") === "yes" ? 1 : 0;
  const now = nowIso();
  const consent = text(formData.get("consent")) || "unknown";
  const city = text(formData.get("city")) || null;
  const state = text(formData.get("state")) || null;
  const country = text(formData.get("country")) || null;
  if (id) {
    const ok = changed(
      run(
        `update contacts set account_id = ?, name = ?, title = ?, department = ?, email = ?, phone = ?, location = ?, city = ?, state = ?, country = ?, buying_role = ?, channel = ?, consent = ?, is_primary = ?, updated_at = ?, version = version + 1 where id = ? and tenant_id = ? and version = ?`,
        accountId,
        name,
        text(formData.get("title")) || null,
        text(formData.get("department")) || null,
        email || null,
        phone || null,
        text(formData.get("location")) || null,
        city,
        state,
        country,
        text(formData.get("buyingRole")) || null,
        text(formData.get("channel")) || "Email",
        consent,
        primary,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    if (primary) {
      run(`update contacts set is_primary = 0 where tenant_id = ? and account_id = ? and id != ?`, user.tenantId, accountId, id);
    }
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "contact", recordId: id, summary: `Updated contact ${name}.` });
    redirect(`/contacts/${id}?notice=Contact saved`);
  }
  const contactId = nid("con");
  run(
    `insert into contacts (id, tenant_id, account_id, name, title, department, email, phone, location, city, state, country, buying_role, channel, consent, is_primary, owner_id, created_at, updated_at, version) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    contactId,
    user.tenantId,
    accountId,
    name,
    text(formData.get("title")) || null,
    text(formData.get("department")) || null,
    email || null,
    phone || null,
    text(formData.get("location")) || null,
    city,
    state,
    country,
    text(formData.get("buyingRole")) || null,
    text(formData.get("channel")) || "Email",
    consent,
    primary,
    user.id,
    now,
    now,
  );
  run(`insert or ignore into contact_accounts (contact_id, account_id) values (?, ?)`, contactId, accountId);
  if (primary) run(`update contacts set is_primary = 0 where tenant_id = ? and account_id = ? and id != ?`, user.tenantId, accountId, contactId);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "contact", recordId: contactId, summary: `Created contact ${name}.` });
  redirect(`/contacts/${contactId}?notice=Contact created`);
}

export async function saveOpportunity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "opportunities")) return { error: "You do not have access to edit opportunities." };
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const accountId = text(formData.get("accountId"));
  const customerType = text(formData.get("customerType"));
  const amount = numberValue(formData.get("amount"));
  const closeDate = text(formData.get("closeDate"));
  const stageId = text(formData.get("stageId"));
  const fields: Record<string, string> = {};
  if (!["new", "existing"].includes(customerType)) {
    fieldError(fields, "customerType", "Choose a valid customer type.");
  }
  if (!name) fieldError(fields, "name", "Opportunity name is required.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose an account.");
  if (amount == null || Number.isNaN(amount) || amount < 0) fieldError(fields, "amount", "Enter a non-negative amount.");
  if (!closeDate) fieldError(fields, "closeDate", "Expected close date is required.");
  const stage = one<{ id: string; name: string; probability: number; kind: string }>(
    `select id, name, probability, kind from stages where id = ? and tenant_id = ?`,
    stageId,
    user.tenantId,
  );
  if (!stage) fieldError(fields, "stageId", "Choose a stage.");
  const lostReason = text(formData.get("lostReason"));
  if (stage?.kind === "lost" && !lostReason) fieldError(fields, "lostReason", "Closed-lost requires a reason.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const status = stage!.kind === "won" ? "won" : stage!.kind === "lost" ? "lost" : "open";
  const now = nowIso();
  const probability = stage!.probability;
  if (id) {
    const previous = one<{ stageId: string; version: number; name: string; ownerId: string }>(
      `select stage_id as stageId, version, name, owner_id as ownerId from opportunities where id = ? and tenant_id = ?`,
      id,
      user.tenantId,
    );
    if (!previous) return { error: "That opportunity is not available." };
    if (user.role === "bdm" && previous.ownerId !== user.id) return { error: "That opportunity is not available." };
    const ok = changed(
      run(
        `update opportunities set name = ?, account_id = ?, contact_id = ?, owner_id = ?, source = ?, stage_id = ?, amount = ?, currency = ?, probability = ?, close_date = ?, service_line = ?, customer_type= ?, competitors = ?, status = ?, lost_reason = ?, closed_at = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        name,
        accountId,
        text(formData.get("contactId")) || null,
        text(formData.get("ownerId")) || user.id,
        text(formData.get("source")) || null,
        stageId,
        amount,
        text(formData.get("currency")) || user.currency,
        probability,
        new Date(closeDate).toISOString(),
        text(formData.get("serviceLine")) || null,
        customerType,
        text(formData.get("competitors")) || null,
        status,
        lostReason || null,
        status === "open" ? null : now,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    if (previous.stageId !== stageId) {
      const from = one<{ name: string }>(`select name from stages where id = ?`, previous.stageId);
      run(
        `insert into stage_history (id, tenant_id, opportunity_id, from_stage, to_stage, actor_id, created_at) values (?, ?, ?, ?, ?, ?, ?)`,
        nid("hist"),
        user.tenantId,
        id,
        from?.name ?? null,
        stage!.name,
        user.id,
        now,
      );
      audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: "stage",
        recordType: "opportunity",
        recordId: id,
        summary: `Moved ${name} from ${from?.name ?? "unknown"} to ${stage!.name}.`,
      });
      runStageRules({
        tenantId: user.tenantId,
        actorId: user.id,
        opportunityId: id,
        opportunityName: name,
        ownerId: text(formData.get("ownerId")) || user.id,
        toStage: stage!.name,
      });
    } else {
      audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "opportunity", recordId: id, summary: `Updated opportunity ${name}.` });
    }
    revalidatePath("/pipeline");
    redirect(`/opportunities/${id}?notice=Opportunity saved`);
  }
  const pipeline = one<{ id: string }>(`select id from pipelines where tenant_id = ? and is_default = 1`, user.tenantId);
  const opportunityId = nid("opp");
  run(
    `insert into opportunities (id, tenant_id, name, account_id, contact_id, owner_id, source, pipeline_id, stage_id, amount, currency, probability, close_date, service_line, customer_type, competitors, status, lost_reason, closed_at, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    opportunityId,
    user.tenantId,
    name,
    accountId,
    text(formData.get("contactId")) || null,
    text(formData.get("ownerId")) || user.id,
    text(formData.get("source")) || null,
    pipeline?.id ?? null,
    stageId,
    amount,
    text(formData.get("currency")) || user.currency,
    probability,
    new Date(closeDate).toISOString(),
    text(formData.get("serviceLine")) || null,
    customerType,
    text(formData.get("competitors")) || null,
    status,
    lostReason || null,
    status === "open" ? null : now,
    now,
    now,
  );

  run(
    `insert into stage_history (id, tenant_id, opportunity_id, from_stage, to_stage, actor_id, created_at) values (?, ?, ?, null, ?, ?, ?)`,
    nid("hist"),
    user.tenantId,
    opportunityId,
    stage!.name,
    user.id,
    now,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "opportunity", recordId: opportunityId, summary: `Created opportunity ${name}.` });
  redirect(`/opportunities/${opportunityId}?notice=Opportunity created`);
}

export async function moveStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "pipeline")) return { error: "You cannot move stages." };
  const id = text(formData.get("id"));
  const stageId = text(formData.get("stageId"));
  const version = Number(formData.get("version"));
  const stage = one<{ id: string; name: string; probability: number; kind: string }>(
    `select id, name, probability, kind from stages where id = ? and tenant_id = ?`,
    stageId,
    user.tenantId,
  );
  if (!stage) return { error: "That stage is not available." };
  if (stage.kind === "lost" && !text(formData.get("lostReason"))) return { error: "A closed-lost reason is required." };
  if (stage.kind === "won" && !text(formData.get("closeDate"))) return { error: "Closed-won needs a close date." };
  const opp = one<{ id: string; name: string; stageId: string; ownerId: string; version: number }>(
    `select id, name, stage_id as stageId, owner_id as ownerId, version from opportunities where id = ? and tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!opp || (user.role === "bdm" && opp.ownerId !== user.id)) return { error: "That opportunity is not available." };
  if (opp.version !== version) return { error: CONFLICT };
  if (opp.stageId === stageId) return { error: "The opportunity is already in that stage." };
  const from = one<{ name: string }>(`select name from stages where id = ?`, opp.stageId);
  const now = nowIso();
  const status = stage.kind === "won" ? "won" : stage.kind === "lost" ? "lost" : "open";
  const ok = changed(
    run(
      `update opportunities set stage_id = ?, probability = ?, status = ?, lost_reason = ?, closed_at = ?, close_date = coalesce(?, close_date), updated_at = ?, version = version + 1
       where id = ? and tenant_id = ? and version = ?`,
      stageId,
      stage.probability,
      status,
      text(formData.get("lostReason")) || null,
      status === "open" ? null : now,
      text(formData.get("closeDate")) ? new Date(text(formData.get("closeDate"))).toISOString() : null,
      now,
      id,
      user.tenantId,
      version,
    ),
  );
  if (!ok) return { error: CONFLICT };
  run(
    `insert into stage_history (id, tenant_id, opportunity_id, from_stage, to_stage, actor_id, created_at) values (?, ?, ?, ?, ?, ?, ?)`,
    nid("hist"),
    user.tenantId,
    id,
    from?.name ?? null,
    stage.name,
    user.id,
    now,
  );
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "stage",
    recordType: "opportunity",
    recordId: id,
    summary: `Moved ${opp.name} from ${from?.name ?? "unknown"} to ${stage.name}.`,
  });
  runStageRules({
    tenantId: user.tenantId,
    actorId: user.id,
    opportunityId: id,
    opportunityName: opp.name,
    ownerId: opp.ownerId,
    toStage: stage.name,
  });
  revalidatePath("/pipeline");
  revalidatePath(`/opportunities/${id}`);
  redirect("/pipeline?notice=Stage updated");
}

export async function saveActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "activities") && !canWrite(user.role, "tasks")) return { error: "You do not have access to edit activities." };
  const subject = text(formData.get("subject"));
  const type = text(formData.get("type")) || "call";

const allowedTypes = ["call", "email", "meeting"];

const fields: Record<string, string> = {};

if (!allowedTypes.includes(type)) {
  fieldError(fields, "type", "Choose a valid activity type.");
}
  const due = text(formData.get("dueAt"));
  const ownerId = text(formData.get("ownerId")) || user.id;
  if (!subject) fieldError(fields, "subject", "Subject is required.");
  if (!due) fieldError(fields, "dueAt", "Due date is required.");
  const end = text(formData.get("endAt"));
  if (end && due && new Date(end) <= new Date(due)) fieldError(fields, "endAt", "End time must be after the start.");
  const status = text(formData.get("status")) || "open";
  if (status === "completed" && !text(formData.get("outcome"))) fieldError(fields, "outcome", "Add an outcome for a completed activity.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const now = nowIso();
  const id = text(formData.get("id"));
  const relatedType = text(formData.get("relatedType")) || null;
  const relatedId = text(formData.get("relatedId")) || null;
  if (id) {
    const ok = changed(
      run(
        `update activities set type = ?, subject = ?, body = ?, status = ?, priority = ?, due_at = ?, owner_id = ?, outcome = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
       type,
        subject,
        text(formData.get("body")) || null,
        status,
        text(formData.get("priority")) || "Normal",
        new Date(due).toISOString(),
        ownerId,
        text(formData.get("outcome")) || null,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "activity", recordId: id, summary: `Updated activity ${subject}.` });
  } else {
    const activityId = nid("act");
    run(
      `insert into activities (id, tenant_id, type, subject, body, status, priority, due_at, owner_id, related_type, related_id, outcome, created_at, updated_at, version)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      activityId,
      user.tenantId,
     type,
      subject,
      text(formData.get("body")) || null,
      status,
      text(formData.get("priority")) || "Normal",
      new Date(due).toISOString(),
      ownerId,
      relatedType,
      relatedId,
      text(formData.get("outcome")) || null,
      now,
      now,
    );
    audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "activity", recordId: activityId, summary: `Created activity ${subject}.` });
  }
  revalidatePath("/activities");
  revalidatePath("/dashboard");
  redirect("/activities?notice=Activity saved");
}

export async function completeActivity(formData: FormData) {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "activities") && !canWrite(user.role, "tasks")) redirect("/activities");
  const id = text(formData.get("id"));
  const outcome = text(formData.get("outcome")) || "Completed";
  const ok = changed(
    run(
      `update activities set status = 'completed', outcome = ?, updated_at = ?, version = version + 1 where id = ? and tenant_id = ? and status = 'open'`,
      outcome,
      nowIso(),
      id,
      user.tenantId,
    ),
  );
  if (ok) {
    audit({ tenantId: user.tenantId, actorId: user.id, action: "complete", recordType: "activity", recordId: id, summary: "Completed an activity." });
  }
  revalidatePath("/activities");
  redirect("/activities?notice=Activity completed");
}
