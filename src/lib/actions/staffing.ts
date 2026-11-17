"use server";

import fs from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { one, run } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { audit, changed, nid, nowIso } from "@/lib/records";
import type { ActionState } from "@/lib/types";
import { fieldError, isEmail, isPhone, numberValue, text } from "@/lib/validate";

const CONFLICT = "This record was updated by someone else. Refresh and reconcile your changes.";
const REQ_STATUS = ["New", "Qualified", "Sourcing", "Submitted", "Interviewing", "On Hold", "Filled", "Cancelled"];
const SUB_STATUS = ["Draft", "Submitted", "Client Review", "Shortlisted", "Interview", "Rejected", "Withdrawn", "Selected"];

export async function saveRequirement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "requirements")) return { error: "You do not have access to edit requirements." };
  const title = text(formData.get("title"));
  const accountId = text(formData.get("accountId"));
  const status = text(formData.get("status")) || "New";
  const positions = numberValue(formData.get("positions"));
  const rateMin = numberValue(formData.get("rateMin"));
  const rateMax = numberValue(formData.get("rateMax"));
  const start = text(formData.get("startDate"));
  const target = text(formData.get("targetDate"));
  const fields: Record<string, string> = {};
  if (!title) fieldError(fields, "title", "Title is required.");
  const account = one(`select id from accounts where id = ? and tenant_id = ?`, accountId, user.tenantId);
  if (!account) fieldError(fields, "accountId", "Choose a client account.");
  if (!REQ_STATUS.includes(status)) fieldError(fields, "status", "Choose a valid status.");
  if (positions == null || !Number.isInteger(positions) || positions < 1) fieldError(fields, "positions", "Position count must be a positive whole number.");
  if (rateMin != null && rateMax != null && rateMax < rateMin) fieldError(fields, "rateMax", "Maximum rate cannot be below the minimum.");
  if (start && target && target < start) fieldError(fields, "targetDate", "Target date cannot be before the start date.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const now = nowIso();
  const id = text(formData.get("id"));
  const values = [
    accountId,
    title,
    text(formData.get("skills")) || null,
    text(formData.get("experience")) || null,
    text(formData.get("location")) || null,
    text(formData.get("workMode")) || null,
    text(formData.get("employmentType")) || null,
    rateMin,
    rateMax,
    user.currency,
    positions,
    text(formData.get("priority")) || "Normal",
    text(formData.get("ownerId")) || user.id,
    status,
    start || null,
    target || null,
    text(formData.get("description")) || null,
    text(formData.get("mustHave")) || null,
    text(formData.get("niceToHave")) || null,
    text(formData.get("hiringManager")) || null,
    now,
  ];
  if (id) {
    const previous = one<{ status: string }>(`select status from requirements where id = ? and tenant_id = ?`, id, user.tenantId);
    if (!previous) return { error: "That requirement is not available." };
    if (previous.status === "Filled" && status !== "Filled" && status !== previous.status && text(formData.get("reopen")) !== "yes" && status !== "Cancelled") {
      if (["Sourcing", "Submitted", "Interviewing", "New", "Qualified"].includes(status)) {
        return { error: "A filled requirement cannot accept new work unless you reopen it." };
      }
    }
    const ok = changed(
      run(
        `update requirements set account_id = ?, title = ?, skills = ?, experience = ?, location = ?, work_mode = ?, employment_type = ?, rate_min = ?, rate_max = ?, currency = ?, positions = ?, priority = ?, owner_id = ?, status = ?, start_date = ?, target_date = ?, description = ?, must_have = ?, nice_to_have = ?, hiring_manager = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        ...values,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "requirement", recordId: id, summary: `Requirement ${title} is now ${status}.` });
    redirect(`/requirements/${id}?notice=Requirement saved`);
  }
  const requirementId = nid("req");
  run(
    `insert into requirements (id, tenant_id, account_id, title, skills, experience, location, work_mode, employment_type, rate_min, rate_max, currency, positions, priority, owner_id, status, start_date, target_date, description, must_have, nice_to_have, hiring_manager, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    requirementId,
    user.tenantId,
    ...values,
    now,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "requirement", recordId: requirementId, summary: `Created requirement ${title}.` });
  redirect(`/requirements/${requirementId}?notice=Requirement created`);
}

export async function saveCandidate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "candidates")) return { error: "You do not have access to edit candidates." };
  const name = text(formData.get("name"));
  const email = text(formData.get("email"));
  const phone = text(formData.get("phone"));
  const years = numberValue(formData.get("experienceYears"));
  const fields: Record<string, string> = {};
  if (!name) fieldError(fields, "name", "Candidate name is required.");
  if (!email && !phone) fieldError(fields, "email", "Add an email or a phone number.");
  if (email && !isEmail(email)) fieldError(fields, "email", "Enter a valid email.");
  if (phone && !isPhone(phone)) fieldError(fields, "phone", "Enter a valid phone number.");
  if (years != null && (Number.isNaN(years) || years < 0)) fieldError(fields, "experienceYears", "Experience cannot be negative.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const now = nowIso();
  const id = text(formData.get("id"));
  const candidateId = id || nid("can");
  const file = formData.get("resume");
  let resumeName: string | null = null;
  let resumePath: string | null = null;
  let parsed: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { fieldErrors: { resume: "Resume must be 5 MB or smaller." } };
    const allowed = ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
      return { fieldErrors: { resume: "Upload a PDF, DOC, DOCX, or TXT resume." } };
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = path.join(process.cwd(), "data", "resumes", user.tenantId, candidateId);
    fs.mkdirSync(dir, { recursive: true });
    const full = path.join(dir, safe);
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(full, bytes);
    resumeName = safe;
    resumePath = full;
    const body = file.type === "text/plain" || /\.txt$/i.test(file.name) ? bytes.toString("utf8") : "";
    parsed = JSON.stringify(suggestFromResume(file.name, body));
  }
  const common = [
    name,
    email || null,
    phone || null,
    text(formData.get("skills")) || null,
    years,
    text(formData.get("location")) || null,
    text(formData.get("workAuth")) || null,
    text(formData.get("availability")) || null,
    numberValue(formData.get("rateExpectation")),
    user.currency,
    text(formData.get("source")) || null,
    text(formData.get("status")) || "Active",
    text(formData.get("summary")) || null,
    text(formData.get("consent")) || "unknown",
    now,
  ];
  if (id) {
    const ok = changed(
      run(
        `update candidates set name = ?, email = ?, phone = ?, skills = ?, experience_years = ?, location = ?, work_auth = ?, availability = ?, rate_expectation = ?, currency = ?, source = ?, status = ?, summary = ?, consent = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        ...common,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    if (resumePath) {
      run(
        `update candidates set resume_name = ?, resume_path = ?, parsed_json = ?, parse_status = 'suggested' where id = ? and tenant_id = ?`,
        resumeName,
        resumePath,
        parsed,
        id,
        user.tenantId,
      );
    }
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "candidate", recordId: id, summary: `Updated candidate ${name}.` });
    redirect(`/candidates/${id}?notice=Candidate saved`);
  }
  run(
    `insert into candidates (id, tenant_id, name, email, phone, skills, experience_years, location, work_auth, availability, rate_expectation, currency, source, status, summary, consent, owner_id, resume_name, resume_path, parsed_json, parse_status, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    candidateId,
    user.tenantId,
    ...common.slice(0, -1),
    user.id,
    resumeName,
    resumePath,
    parsed,
    parsed ? "suggested" : "none",
    now,
    now,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "candidate", recordId: candidateId, summary: `Created candidate ${name}.` });
  redirect(`/candidates/${candidateId}?notice=Candidate created`);
}

function suggestFromResume(filename: string, body: string) {
  const vocabulary = ["Java", "Spring", "PostgreSQL", "ServiceNow", "ITSM", "Python", "dbt", "Snowflake", "React", "ITIL", "Kafka"];
  const haystack = `${filename} ${body}`.toLowerCase();
  const skills = vocabulary.filter((skill) => haystack.includes(skill.toLowerCase()));
  return {
    skills,
    note: skills.length
      ? "Suggested from the resume text. Accept only after you review them."
      : "No skills were extracted. Review the file and enter skills yourself.",
  };
}

export async function acceptParsed(formData: FormData) {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "candidates")) redirect("/candidates");
  const id = text(formData.get("id"));
  const row = one<{ parsedJson: string | null; skills: string | null }>(
    `select parsed_json, skills from candidates where id = ? and tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!row?.parsedJson) redirect(`/candidates/${id}`);
  const parsed = JSON.parse(row.parsedJson) as { skills?: string[] };
  const merged = Array.from(new Set([...(row.skills ?? "").split(",").map((item) => item.trim()).filter(Boolean), ...(parsed.skills ?? [])]));
  run(
    `update candidates set skills = ?, parse_status = 'accepted', updated_at = ?, version = version + 1 where id = ? and tenant_id = ?`,
    merged.join(", "),
    nowIso(),
    id,
    user.tenantId,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "accept_parse", recordType: "candidate", recordId: id, summary: "Accepted resume suggestions." });
  redirect(`/candidates/${id}?notice=Suggestions accepted`);
}

export async function saveSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "submissions")) return { error: "You do not have access to edit submissions." };
  const candidateId = text(formData.get("candidateId"));
  const requirementId = text(formData.get("requirementId"));
  const status = text(formData.get("status")) || "Draft";
  const fields: Record<string, string> = {};
  const candidate = one(`select id from candidates where id = ? and tenant_id = ?`, candidateId, user.tenantId);
  const requirement = one<{ status: string }>(`select status from requirements where id = ? and tenant_id = ?`, requirementId, user.tenantId);
  if (!candidate) fieldError(fields, "candidateId", "Choose a candidate.");
  if (!requirement) fieldError(fields, "requirementId", "Choose a requirement.");
  if (requirement?.status === "Filled") fieldError(fields, "requirementId", "That requirement is filled. Reopen it before submitting.");
  if (!SUB_STATUS.includes(status)) fieldError(fields, "status", "Choose a valid status.");
  if ((status === "Rejected" || status === "Withdrawn") && !text(formData.get("notes"))) {
    fieldError(fields, "notes", "Add a reason for rejection or withdrawal.");
  }
  const id = text(formData.get("id"));
  const duplicate = one<{ id: string }>(
    `select id from submissions where tenant_id = ? and candidate_id = ? and requirement_id = ? and id != ? and status not in ('Rejected','Withdrawn')`,
    user.tenantId,
    candidateId,
    requirementId,
    id || "",
  );
  if (duplicate && text(formData.get("confirmDuplicate")) !== "yes") {
    return { warning: "This candidate already has an active submission on that requirement.", duplicateId: duplicate.id };
  }
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const now = nowIso();
  if (id) {
    const ok = changed(
      run(
        `update submissions set candidate_id = ?, requirement_id = ?, proposed_rate = ?, currency = ?, status = ?, notes = ?, updated_at = ?, version = version + 1
         where id = ? and tenant_id = ? and version = ?`,
        candidateId,
        requirementId,
        numberValue(formData.get("proposedRate")),
        user.currency,
        status,
        text(formData.get("notes")) || null,
        now,
        id,
        user.tenantId,
        Number(formData.get("version")),
      ),
    );
    if (!ok) return { error: CONFLICT };
    audit({ tenantId: user.tenantId, actorId: user.id, action: "update", recordType: "submission", recordId: id, summary: `Submission status is ${status}.` });
    redirect(`/submissions/${id}?notice=Submission saved`);
  }
  const submissionId = nid("sub");
  run(
    `insert into submissions (id, tenant_id, candidate_id, requirement_id, recruiter_id, proposed_rate, currency, status, notes, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    submissionId,
    user.tenantId,
    candidateId,
    requirementId,
    user.id,
    numberValue(formData.get("proposedRate")),
    user.currency,
    status,
    text(formData.get("notes")) || null,
    now,
    now,
  );
  audit({ tenantId: user.tenantId, actorId: user.id, action: "create", recordType: "submission", recordId: submissionId, summary: "Created a candidate submission." });
  redirect(`/submissions/${submissionId}?notice=Submission created`);
}

export async function saveInterview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "submissions")) return { error: "You do not have access to schedule interviews." };
  const submissionId = text(formData.get("submissionId"));
  const when = text(formData.get("scheduledAt"));
  const participants = text(formData.get("participants"));
  const outcome = text(formData.get("outcome"));
  const fields: Record<string, string> = {};
  const submission = one(`select id from submissions where id = ? and tenant_id = ?`, submissionId, user.tenantId);
  if (!submission) fieldError(fields, "submissionId", "Choose a submission.");
  if (!when) fieldError(fields, "scheduledAt", "Date and time are required.");
  if (!participants) fieldError(fields, "participants", "Add at least one participant.");
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const id = nid("int");
  const now = nowIso();
  run(
    `insert into interviews (id, tenant_id, submission_id, round_name, scheduled_at, mode, participants, feedback, outcome, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.tenantId,
    submissionId,
    text(formData.get("roundName")) || "Interview",
    new Date(when).toISOString(),
    text(formData.get("mode")) || "Video",
    participants,
    text(formData.get("feedback")) || null,
    outcome || "Scheduled",
    now,
  );
  if (outcome === "Advance" || outcome === "Scheduled") {
    run(`update submissions set status = 'Interview', updated_at = ?, version = version + 1 where id = ? and tenant_id = ?`, now, submissionId, user.tenantId);
  } else if (outcome === "Reject") {
    run(`update submissions set status = 'Rejected', updated_at = ?, version = version + 1 where id = ? and tenant_id = ?`, now, submissionId, user.tenantId);
  }
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "interview",
    recordType: "submission",
    recordId: submissionId,
    summary: `Recorded interview outcome: ${outcome || "Scheduled"}.`,
  });
  redirect(`/submissions/${submissionId}?notice=Interview saved`);
}

export async function savePlacement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!canWrite(user.role, "placements")) return { error: "You do not have access to create placements." };
  const submissionId = text(formData.get("submissionId"));
  const start = text(formData.get("startDate"));
  const end = text(formData.get("endDate"));
  const fields: Record<string, string> = {};
  const submission = one<{ candidateId: string; requirementId: string; status: string; accountId: string }>(
    `select s.candidate_id as candidateId, s.requirement_id as requirementId, s.status, r.account_id as accountId
     from submissions s join requirements r on r.id = s.requirement_id
     where s.id = ? and s.tenant_id = ?`,
    submissionId,
    user.tenantId,
  );
  if (!submission) fieldError(fields, "submissionId", "Choose a submission.");
  if (submission && submission.status !== "Selected" && text(formData.get("override")) !== "yes") {
    fieldError(fields, "submissionId", "Placement requires a selected submission, or an authorized override.");
  }
  if (!start) fieldError(fields, "startDate", "Start date is required.");
  if (end && end < start) fieldError(fields, "endDate", "End date cannot be before the start date.");
  if (user.role !== "owner" && user.role !== "admin" && user.role !== "manager" && text(formData.get("override")) === "yes") {
    fieldError(fields, "override", "Only a manager or administrator can override selection.");
  }
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const id = nid("plc");
  const now = nowIso();
  run(
    `insert into placements (id, tenant_id, submission_id, account_id, candidate_id, requirement_id, role, start_date, end_date, bill_rate, pay_rate, currency, owner_id, status, notes, renewal_date, created_at, updated_at, version)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, 1)`,
    id,
    user.tenantId,
    submissionId,
    submission!.accountId,
    submission!.candidateId,
    submission!.requirementId,
    text(formData.get("role")),
    start,
    end || null,
    numberValue(formData.get("billRate")),
    numberValue(formData.get("payRate")),
    user.currency,
    user.id,
    text(formData.get("notes")) || null,
    text(formData.get("renewalDate")) || null,
    now,
    now,
  );
  run(`update requirements set status = 'Filled', updated_at = ? where id = ? and tenant_id = ?`, now, submission!.requirementId, user.tenantId);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "placement", recordType: "placement", recordId: id, summary: "Created a placement from a submission." });
  redirect(`/placements?notice=Placement created`);
}
