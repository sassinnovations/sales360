"use server";

import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { one, run, transaction } from "@/db";
import {
  MFA,
  PREAUTH,
  SESSION,
  clearAttempts,
  clearAuthCookie,
  getCurrentUser,
  readCookie,
  recordAttempt,
  setAuthCookie,
  tooManyAttempts,
  writeSession,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { canGrantRole } from "@/lib/permissions";
import { activeUsersByEmail, tenantBySlug } from "@/lib/queries";
import { audit, hoursFromNow, nid, nowIso } from "@/lib/records";
import type { ActionState, Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { fieldError, isEmail, isWebsite, text } from "@/lib/validate";
import { slugify } from "@/lib/format";

const STAGES: [string, number, string][] = [
  ["Qualification", 10, "open"],
  ["Discovery", 25, "open"],
  ["Proposal", 50, "open"],
  ["Negotiation", 75, "open"],
  ["Closed Won", 100, "won"],
  ["Closed Lost", 0, "lost"],
];

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData.get("email")).toLowerCase();
  const password = text(formData.get("password"));
  if (!email || !password) return { error: "Enter your email and password." };
  if (tooManyAttempts(email)) return { error: "Too many attempts. Try again in a few minutes." };
  const matches = activeUsersByEmail(email).filter(
    (user) => user.status === "active" && verifyPassword(password, user.passwordHash),
  );
  if (!matches.length) {
    recordAttempt(email);
    return { error: "Invalid email or password." };
  }
  clearAttempts(email);
  if (matches.length > 1) {
    const pending = writeSession({ email, kind: "preauth", hours: 0.25 });
    await setAuthCookie(PREAUTH, pending, 0.25);
    redirect("/login/workspace");
  }
  const user = matches[0];
  if (user.mfaEnabled || user.mfaRequired) {
    const pending = writeSession({ userId: user.id, kind: "mfa", hours: 0.25 });
    await setAuthCookie(MFA, pending, 0.25);
    redirect("/login/mfa");
  }
  const hours = formData.get("remember") === "on" ? 24 * 14 : 12;
  const session = writeSession({ userId: user.id, kind: "session", hours });
  await setAuthCookie(SESSION, session, hours);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "login", recordType: "user", recordId: user.id, summary: "Signed in." });
  redirect("/dashboard");
}

export async function chooseWorkspace(formData: FormData) {
  const cookie = await readCookie(PREAUTH);
  const userId = text(formData.get("userId"));
  const session = cookie
    ? one<{ email: string }>(`select email from sessions where token = ? and kind = 'preauth' and expires_at > ?`, cookie, nowIso())
    : undefined;
  if (!session?.email) redirect("/login?notice=Choose a workspace again");
  const user = one<{ id: string; tenantId: string; mfaEnabled: number; mfaRequired: number }>(
    `select u.id, u.tenant_id, u.mfa_enabled, t.mfa_required from users u join tenants t on t.id = u.tenant_id
     where u.id = ? and lower(u.email) = lower(?) and u.status = 'active'`,
    userId,
    session.email,
  );
  if (!user) redirect("/login");
  run(`delete from sessions where token = ?`, cookie!);
  await clearAuthCookie(PREAUTH);
  if (user.mfaEnabled || user.mfaRequired) {
    const pending = writeSession({ userId: user.id, kind: "mfa", hours: 0.25 });
    await setAuthCookie(MFA, pending, 0.25);
    redirect("/login/mfa");
  }
  const next = writeSession({ userId: user.id, kind: "session", hours: 12 });
  await setAuthCookie(SESSION, next, 12);
  redirect("/dashboard");
}

export async function verifyMfa(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const cookie = await readCookie(MFA);
  const pending = cookie
    ? one<{ userId: string }>(`select user_id as userId from sessions where token = ? and kind = 'mfa' and expires_at > ?`, cookie, nowIso())
    : undefined;
  if (!pending?.userId) redirect("/login");
  const user = one<{ id: string; tenantId: string; mfaCode: string | null }>(
    `select id, tenant_id, mfa_code from users where id = ? and status = 'active'`,
    pending.userId,
  );
  if (!user) redirect("/login");
  const code = text(formData.get("code"));
  if (!/^\d{6}$/.test(code)) return { fieldErrors: { code: "Enter the 6-digit code." } };
  if (!user.mfaCode) {
    run(`update users set mfa_enabled = 1, mfa_code = ? where id = ?`, code, user.id);
    audit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: "mfa_enroll",
      recordType: "user",
      recordId: user.id,
      summary: "Enrolled a multi-factor code.",
    });
  } else if (user.mfaCode !== code) {
    return { error: "That code was not accepted." };
  }
  run(`delete from sessions where token = ?`, cookie!);
  await clearAuthCookie(MFA);
  const session = writeSession({ userId: user.id, kind: "session", hours: 12 });
  await setAuthCookie(SESSION, session, 12);
  redirect("/dashboard");
}

export async function logout() {
  const user = await getCurrentUser();
  const cookie = await readCookie(SESSION);
  if (cookie) run(`delete from sessions where token = ?`, cookie);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "logout", recordType: "user", recordId: user.id, summary: "Signed out." });
  await clearAuthCookie(SESSION);
  redirect("/login");
}

export async function logoutAll() {
  const user = await getCurrentUser();
  run(`delete from sessions where user_id = ?`, user.id);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "logout_all", recordType: "user", recordId: user.id, summary: "Signed out of every session." });
  await clearAuthCookie(SESSION);
  redirect("/login");
}

export async function requestReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData.get("email")).toLowerCase();
  if (!isEmail(email)) return { error: "If an account exists for that email, a reset code is ready." };
  const users = activeUsersByEmail(email).filter((user) => user.status === "active");
  let devCode: string | undefined;
  for (const user of users) {
    const code = String(randomInt(100000, 999999));
    run(`update users set reset_code = ?, reset_expires = ? where id = ?`, code, hoursFromNow(0.5), user.id);
    devCode = code;
  }
  if (process.env.NODE_ENV !== "production" && devCode) {
    return { warning: `Local demo only — no email is sent. Reset code: ${devCode}` };
  }
  return { error: "If an account exists for that email, a reset code is ready. It expires in 30 minutes." };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData.get("email")).toLowerCase();
  const code = text(formData.get("code"));
  const password = text(formData.get("password"));
  const confirm = text(formData.get("confirm"));
  const fields: Record<string, string> = {};
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  if (password !== confirm) fields.confirm = "Passwords do not match.";
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const user = one<{ id: string; tenantId: string }>(
    `select id, tenant_id from users where lower(email) = lower(?) and reset_code = ? and reset_expires > ? and status = 'active'`,
    email,
    code,
    nowIso(),
  );
  if (!user) return { error: "That reset code is invalid or expired." };
  run(`update users set password_hash = ?, reset_code = null, reset_expires = null where id = ?`, hashPassword(password), user.id);
  run(`delete from sessions where user_id = ?`, user.id);
  audit({ tenantId: user.tenantId, actorId: user.id, action: "password_reset", recordType: "user", recordId: user.id, summary: "Password was reset." });
  redirect("/login?notice=Password updated. Sign in with the new password.");
}

export async function onboard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fields: Record<string, string> = {};
  const name = text(formData.get("name"));
  const legal = text(formData.get("legalName"));
  const industry = text(formData.get("industry"));
  const size = text(formData.get("companySize"));
  const website = text(formData.get("website"));
  const country = text(formData.get("country"));
  const timezone = text(formData.get("timezone"));
  const currency = text(formData.get("currency"));
  const profile = text(formData.get("profile"));
  const adminName = text(formData.get("adminName"));
  const adminEmail = text(formData.get("adminEmail")).toLowerCase();
  const password = text(formData.get("password"));
  const pipeline = text(formData.get("pipeline")) || "Default sales";
  if (!name) fieldError(fields, "name", "Organization name is required.");
  if (!country) fieldError(fields, "country", "Country is required.");
  if (!timezone) fieldError(fields, "timezone", "Timezone is required.");
  if (!currency) fieldError(fields, "currency", "Base currency is required.");
  if (!["b2b", "staffing", "combined"].includes(profile)) fieldError(fields, "profile", "Choose an operating profile.");
  if (website && !isWebsite(website)) fieldError(fields, "website", "Enter a valid website.");
  if (!adminName) fieldError(fields, "adminName", "Admin name is required.");
  if (!isEmail(adminEmail)) fieldError(fields, "adminEmail", "A valid admin email is required.");
  if (password.length < 8) fieldError(fields, "password", "Use at least 8 characters.");
  let slug = slugify(text(formData.get("slug")) || name);
  if (!slug) fieldError(fields, "slug", "Workspace address is required.");
  if (slug && tenantBySlug(slug)) fieldError(fields, "slug", "That workspace address is already in use.");
  if (Object.keys(fields).length) return { fieldErrors: fields };

  const tenantId = nid("ten");
  const userId = nid("usr");
  const pipelineId = nid("pip");
  const now = nowIso();
  transaction(() => {
    run(
      `insert into tenants (id, name, legal_name, slug, industry, company_size, website, country, timezone, currency, profile, mfa_required, approval_discount_pct, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 10, ?)`,
      tenantId,
      name,
      legal || name,
      slug,
      industry || null,
      size || null,
      website || null,
      country,
      timezone,
      currency,
      profile,
      now,
    );
    run(
      `insert into users (id, tenant_id, name, email, password_hash, role, team, title, status, mfa_enabled, created_at)
       values (?, ?, ?, ?, ?, 'owner', 'Leadership', 'Owner', 'active', 0, ?)`,
      userId,
      tenantId,
      adminName,
      adminEmail,
      hashPassword(password),
      now,
    );
    run(`insert into pipelines (id, tenant_id, name, is_default) values (?, ?, ?, 1)`, pipelineId, tenantId, pipeline);
    STAGES.forEach(([stageName, probability, kind], index) => {
      run(
        `insert into stages (id, tenant_id, pipeline_id, name, probability, sort_order, kind) values (?, ?, ?, ?, ?, ?, ?)`,
        nid("stg"),
        tenantId,
        pipelineId,
        stageName,
        probability,
        index + 1,
        kind,
      );
    });
    const defaults: [string, string[]][] = [
      ["lead_sources", ["Website", "Referral", "Campaign", "Partner", "Event", "Inbound call"]],
      ["industries", ["Banking", "Healthcare", "Logistics", "Retail", "Insurance", "Technology"]],
      ["lost_reasons", ["Budget", "Timing", "Competitor", "No decision", "Poor fit"]],
      ["service_lines", ["Application services", "Staffing", "Managed services", "Data & AI"]],
      ["account_types", ["Prospect", "Customer", "Partner"]],
    ];
    for (const [key, value] of defaults) {
      run(`insert into settings (tenant_id, key, value) values (?, ?, ?)`, tenantId, key, JSON.stringify(value));
    }
    audit({ tenantId, actorId: userId, action: "tenant_created", recordType: "tenant", recordId: tenantId, summary: `Provisioned workspace ${name}.` });
  });
  const session = writeSession({ userId, kind: "session", hours: 12 });
  await setAuthCookie(SESSION, session, 12);
  redirect("/dashboard?notice=Workspace ready");
}

export async function acceptInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const invite = text(formData.get("token"));
  const name = text(formData.get("name"));
  const password = text(formData.get("password"));
  const accepted = formData.get("terms") === "yes";
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Name is required.";
  if (password.length < 8) fields.password = "Use at least 8 characters.";
  if (!accepted) fields.terms = "Accept the workspace terms to continue.";
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const user = one<{ id: string; tenantId: string; status: string; inviteExpires: string | null }>(
    `select id, tenant_id, status, invite_expires from users where invite_token = ?`,
    invite,
  );
  if (!user || user.status !== "invited" || !user.inviteExpires || user.inviteExpires < nowIso()) {
    return { error: "This invitation is expired or no longer valid." };
  }
  run(
    `update users set name = ?, password_hash = ?, status = 'active', invite_token = null, invite_expires = null where id = ?`,
    name,
    hashPassword(password),
    user.id,
  );
  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "user_activated",
    recordType: "user",
    recordId: user.id,
    summary: "Accepted an invitation and activated membership.",
  });
  const session = writeSession({ userId: user.id, kind: "session", hours: 12 });
  await setAuthCookie(SESSION, session, 12);
  redirect("/dashboard");
}

export async function inviteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentUser();
  if (actor.role !== "owner" && actor.role !== "admin") return { error: "You do not have access to invite people." };
  const name = text(formData.get("name"));
  const email = text(formData.get("email")).toLowerCase();
  const role = text(formData.get("role")) as Role;
  const team = text(formData.get("team"));
  const fields: Record<string, string> = {};
  if (!name) fields.name = "Name is required.";
  if (!isEmail(email)) fields.email = "Enter a valid email.";
  if (!ROLES.includes(role)) fields.role = "Choose a role.";
  if (ROLES.includes(role) && !canGrantRole(actor.role, role)) fields.role = "You cannot grant a role above your own.";
  const existing = one(`select id from users where tenant_id = ? and lower(email) = lower(?)`, actor.tenantId, email);
  if (existing) fields.email = "That email is already in this workspace.";
  if (Object.keys(fields).length) return { fieldErrors: fields };
  const id = nid("usr");
  const invite = nid("inv") + nid("inv");
  run(
    `insert into users (id, tenant_id, name, email, role, team, status, invite_token, invite_expires, mfa_enabled, created_at)
     values (?, ?, ?, ?, ?, ?, 'invited', ?, ?, 0, ?)`,
    id,
    actor.tenantId,
    name,
    email,
    role,
    team || null,
    invite,
    hoursFromNow(24 * 7),
    nowIso(),
  );
  audit({
    tenantId: actor.tenantId,
    actorId: actor.id,
    action: "user_invited",
    recordType: "user",
    recordId: id,
    summary: `Invited ${email} as ${role}.`,
  });
  redirect(`/admin/users?notice=Invitation created&invite=${invite}`);
}

export async function revokeInvite(formData: FormData) {
  const actor = await getCurrentUser();
  if (actor.role !== "owner" && actor.role !== "admin") redirect("/dashboard");
  const id = text(formData.get("id"));
  run(
    `update users set status = 'disabled', invite_token = null, invite_expires = null where id = ? and tenant_id = ? and status = 'invited'`,
    id,
    actor.tenantId,
  );
  audit({ tenantId: actor.tenantId, actorId: actor.id, action: "invite_revoked", recordType: "user", recordId: id, summary: "Revoked a pending invitation." });
  redirect("/admin/users?notice=Invitation revoked");
}

export async function preauthWorkspaces() {
  const cookie = await readCookie(PREAUTH);
  if (!cookie) return [];
  const session = one<{ email: string }>(
    `select email from sessions where token = ? and kind = 'preauth' and expires_at > ?`,
    cookie,
    nowIso(),
  );
  if (!session?.email) return [];
  return activeUsersByEmail(session.email).filter((user) => user.status === "active");
}

export async function mfaEnrollment() {
  const cookie = await readCookie(MFA);
  if (!cookie) return null;
  const pending = one<{ userId: string }>(
    `select user_id as userId from sessions where token = ? and kind = 'mfa' and expires_at > ?`,
    cookie,
    nowIso(),
  );
  if (!pending?.userId) return null;
  return one<{ mfaCode: string | null }>(`select mfa_code from users where id = ?`, pending.userId);
}
