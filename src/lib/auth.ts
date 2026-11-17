import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, run } from "@/db";
import { hoursFromNow, nid, nowIso, token } from "./records";
import { ROLES, type Role, type SessionUser } from "./types";

const SESSION = "sales360_session";
const MFA = "sales360_mfa";
const PREAUTH = "sales360_preauth";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function setAuthCookie(name: typeof SESSION | typeof MFA | typeof PREAUTH, value: string, hours: number) {
  const jar = await cookies();
  jar.set(name, value, { ...baseCookie, maxAge: Math.round(hours * 60 * 60) });
}

export async function clearAuthCookie(name: typeof SESSION | typeof MFA | typeof PREAUTH) {
  const jar = await cookies();
  jar.delete(name);
}

export function writeSession(input: { userId?: string | null; email?: string | null; kind: string; hours: number }) {
  const value = token();
  run(
    `insert into sessions (token, user_id, email, kind, expires_at, created_at) values (?, ?, ?, ?, ?, ?)`,
    value,
    input.userId ?? null,
    input.email ?? null,
    input.kind,
    hoursFromNow(input.hours),
    nowIso(),
  );
  return value;
}

export async function getCurrentUser(): Promise<SessionUser> {
  const jar = await cookies();
  const value = jar.get(SESSION)?.value;
  if (!value) redirect("/login");
  const row = one<{
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: string;
    team: string | null;
    title: string | null;
    status: string;
    tenantName: string;
    currency: string;
    timezone: string;
    profile: string;
    slug: string;
    mfaRequired: number;
    approvalDiscountPct: number;
  }>(
    `select u.id, u.tenant_id, u.name, u.email, u.role, u.team, u.title, u.status,
            t.name as tenant_name, t.currency, t.timezone, t.profile, t.slug, t.mfa_required, t.approval_discount_pct
     from sessions s
     join users u on u.id = s.user_id
     join tenants t on t.id = u.tenant_id
     where s.token = ? and s.kind = 'session' and s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    value,
  );
  if (!row || row.status !== "active" || !ROLES.includes(row.role as Role)) redirect("/login");
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    team: row.team ?? "",
    title: row.title ?? "",
    status: row.status,
    tenantName: row.tenantName,
    currency: row.currency,
    timezone: row.timezone,
    profile: row.profile,
    slug: row.slug,
    mfaRequired: Boolean(row.mfaRequired),
    approvalDiscountPct: Number(row.approvalDiscountPct),
  };
}

export function tooManyAttempts(email: string) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const row = one<{ count: number }>(
    `select count(*) as count from login_attempts where lower(email) = lower(?) and created_at > ?`,
    email,
    since,
  );
  return Number(row?.count ?? 0) >= 5;
}

export function recordAttempt(email: string) {
  run(`insert into login_attempts (id, email, created_at) values (?, ?, ?)`, nid("try"), email.toLowerCase(), nowIso());
}

export function clearAttempts(email: string) {
  run(`delete from login_attempts where lower(email) = lower(?)`, email);
}

export async function readCookie(name: typeof SESSION | typeof MFA | typeof PREAUTH) {
  return (await cookies()).get(name)?.value;
}

export { MFA, PREAUTH, SESSION };
