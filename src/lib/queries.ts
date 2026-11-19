import { all, one } from "@/db";
import { canAccess, canSeeCandidateRates, canSeeMargin } from "./permissions";
import { audit } from "./records";
import type { SessionUser } from "./types";

const SCOPED = new Set([
  "leads",
  "accounts",
  "contacts",
  "opportunities",
  "activities",
  "requirements",
  "candidates",
  "submissions",
  "placements",
  "proposals",
  "contracts",
  "cases",
  "campaigns",
]);

function ownSales(user: SessionUser, column: string) {
  if (user.role === "bdm") return { sql: `${column} = ?`, params: [user.id] };
  return { sql: "1 = 1", params: [] as string[] };
}

function ownActivity(user: SessionUser, column = "owner_id") {
  if (user.role === "owner" || user.role === "admin" || user.role === "manager" || user.role === "auditor") {
    return { sql: "1 = 1", params: [] as string[] };
  }
  return { sql: `${column} = ?`, params: [user.id] };
}

export function settingList(tenantId: string, key: string, fallback: string[]) {
  const row = one<{ value: string }>(`select value from settings where tenant_id = ? and key = ?`, tenantId, key);
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value) as string[];
    return Array.isArray(parsed) && parsed.length ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function logCrossTenant(user: SessionUser, table: string, id: string) {
  if (!SCOPED.has(table) || !id) return;
  const row = one<{ tenantId: string }>(`select tenant_id as tenantId from ${table} where id = ?`, id);
  if (row && row.tenantId !== user.tenantId) {
    audit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: "cross_tenant_denied",
      recordType: table,
      recordId: id,
      summary: "Blocked an attempt to open a record outside this workspace.",
    });
  }
}

export function usersInTenant(tenantId: string) {
  return all<{ id: string; name: string; email: string; role: string; team: string; title: string; status: string }>(
    `select id, name, email, role, team, title, status from users where tenant_id = ? order by name`,
    tenantId,
  );
}

export function stagesFor(tenantId: string) {
  return all<{ id: string; name: string; probability: number; sortOrder: number; kind: string; pipelineId: string }>(
    `select id, name, probability, sort_order, kind, pipeline_id from stages where tenant_id = ? order by sort_order`,
    tenantId,
  );
}

export function accountsFor(user: SessionUser) {
  return all<{ id: string; name: string }>(
    `select id, name from accounts where tenant_id = ? and status != 'Archived' order by name`,
    user.tenantId,
  );
}

export function dashboard(user: SessionUser) {
  const seeLeads = canAccess(user.role, "leads");
  const seeOpps = canAccess(user.role, "opportunities");
  const seeStaffing = canAccess(user.role, "requirements");
  const sales = ownSales(user, "owner_id");
  const tasks = ownActivity(user);
  const leadWhere = `tenant_id = ? and ${sales.sql}`;
  const oppWhere = `tenant_id = ? and ${sales.sql}`;
  const openLeads = seeLeads
    ? one<{ count: number }>(
        `select count(*) as count from leads where ${leadWhere} and status in ('New','Working','Qualified')`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const qualified = seeLeads
    ? one<{ count: number }>(
        `select count(*) as count from leads where ${leadWhere} and status = 'Qualified'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const openOpps = seeOpps
    ? one<{ count: number }>(
        `select count(*) as count from opportunities where ${oppWhere} and status = 'open'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const weighted = seeOpps
    ? one<{ total: number }>(
        `select coalesce(sum(amount * probability / 100.0), 0) as total from opportunities where ${oppWhere} and status = 'open'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const won = seeOpps
    ? one<{ total: number }>(
        `select coalesce(sum(amount), 0) as total from opportunities where ${oppWhere} and status = 'won'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const openRequirements = seeStaffing
    ? one<{ count: number }>(
        `select count(*) as count from requirements where tenant_id = ? and status not in ('Filled', 'Cancelled', 'Closed')`,
        user.tenantId,
      )
    : undefined;
  const candidates = canAccess(user.role, "candidates")
    ? one<{ count: number }>(`select count(*) as count from candidates where tenant_id = ?`, user.tenantId)
    : undefined;
  const openSubmissions = canAccess(user.role, "submissions")
    ? one<{ count: number }>(
        `select count(*) as count from submissions where tenant_id = ? and status not in ('Rejected', 'Withdrawn', 'Placed')`,
        user.tenantId,
      )
    : undefined;
  const overdue = one<{ count: number }>(
    `select count(*) as count from activities where tenant_id = ? and ${tasks.sql} and type = 'task' and status = 'open' and due_at < ?`,
    user.tenantId,
    ...tasks.params,
    new Date().toISOString(),
  );
  const meetings = all<{ id: string; subject: string; dueAt: string }>(
    `select id, subject, due_at from activities
     where tenant_id = ? and ${tasks.sql} and type = 'meeting' and status = 'open' and due_at >= ?
     order by due_at limit 4`,
    user.tenantId,
    ...tasks.params,
    new Date().toISOString(),
  );
  const dueToday = all<{ id: string; subject: string; priority: string; relatedType: string | null; relatedId: string | null }>(
    `select id, subject, priority, related_type, related_id from activities
     where tenant_id = ? and ${tasks.sql} and type = 'task' and status = 'open' and due_at <= ?
     order by due_at limit 6`,
    user.tenantId,
    ...tasks.params,
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  );
  const stages = seeOpps ? stagesFor(user.tenantId).filter((stage) => stage.kind === "open") : [];
  const opps = seeOpps
    ? all<{ stageId: string; amount: number }>(
        `select stage_id, amount from opportunities where ${oppWhere} and status = 'open'`,
        user.tenantId,
        ...sales.params,
      )
    : [];
  const stageBars = stages.map((stage) => {
    const rows = opps.filter((opp) => opp.stageId === stage.id);
    return {
      name: stage.name,
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  });
  const feed = all<{ id: string; type: string; subject: string; createdAt: string; ownerName: string | null }>(
    `select a.id, a.type, a.subject, a.created_at, u.name as owner_name
     from activities a left join users u on u.id = a.owner_id
     where a.tenant_id = ? and ${tasks.sql.split("owner_id").join("a.owner_id")}
     order by a.created_at desc limit 6`,
    user.tenantId,
    ...tasks.params,
  );
  const hotLeads = canAccess(user.role, "leads")
    ? all<{ id: string; name: string | null; company: string | null; score: number }>(
        `select id, name, company, score from leads
         where ${leadWhere} and status in ('New','Working','Qualified') and score >= 70
         order by score desc limit 3`,
        user.tenantId,
        ...sales.params,
      )
    : [];
  const closing = canAccess(user.role, "opportunities")
    ? all<{ id: string; name: string; closeDate: string; amount: number; currency: string }>(
        `select id, name, close_date, amount, currency from opportunities
         where ${oppWhere} and status = 'open' and close_date <= ?
         order by close_date limit 3`,
        user.tenantId,
        ...sales.params,
        new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      )
    : [];
  const renewals = canAccess(user.role, "renewals")
    ? all<{ id: string; name: string; endDate: string; accountName: string }>(
        `select c.id, c.name, c.end_date, a.name as account_name
         from contracts c join accounts a on a.id = c.account_id
         where c.tenant_id = ? and c.status = 'Active' and c.end_date <= ?
         order by c.end_date limit 3`,
        user.tenantId,
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      )
    : [];
  const totalLeads = seeLeads
    ? one<{ count: number }>(
        `select count(*) as count from leads where ${leadWhere} and status != 'Archived'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const pipelineValue = seeOpps
    ? one<{ total: number }>(
        `select coalesce(sum(amount), 0) as total from opportunities where ${oppWhere} and status = 'open'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const wonCount = seeOpps
    ? one<{ count: number }>(
        `select count(*) as count from opportunities where ${oppWhere} and status = 'won'`,
        user.tenantId,
        ...sales.params,
      )
    : undefined;
  const recentStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const priorStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const trend = (table: "leads" | "opportunities", extra = "") => {
    const recent = one<{ count: number }>(
      `select count(*) as count from ${table} where tenant_id = ? and ${sales.sql} and created_at >= ? ${extra}`,
      user.tenantId,
      ...sales.params,
      recentStart,
    );
    const prior = one<{ count: number }>(
      `select count(*) as count from ${table} where tenant_id = ? and ${sales.sql} and created_at >= ? and created_at < ? ${extra}`,
      user.tenantId,
      ...sales.params,
      priorStart,
      recentStart,
    );
    const recentCount = Number(recent?.count ?? 0);
    if (!recentCount) return null;
    return changePct(recentCount, Number(prior?.count ?? 0));
  };
  const months = lastMonths(6);
  const monthStart = `${months[0].key}-01`;
  const leadByMonth = seeLeads
    ? all<{ month: string; count: number }>(
        `select substr(created_at, 1, 7) as month, count(*) as count from leads
         where tenant_id = ? and ${sales.sql} and created_at >= ? group by month`,
        user.tenantId,
        ...sales.params,
        monthStart,
      )
    : [];
  const oppByMonth = seeOpps
    ? all<{ month: string; count: number }>(
        `select substr(created_at, 1, 7) as month, count(*) as count from opportunities
         where tenant_id = ? and ${sales.sql} and created_at >= ? group by month`,
        user.tenantId,
        ...sales.params,
        monthStart,
      )
    : [];

  return {
    openLeads: Number(openLeads?.count ?? 0),
    totalLeads: Number(totalLeads?.count ?? 0),
    qualified: Number(qualified?.count ?? 0),
    openOpps: Number(openOpps?.count ?? 0),
    weighted: Number(weighted?.total ?? 0),
    pipelineValue: Number(pipelineValue?.total ?? 0),
    wonCount: Number(wonCount?.count ?? 0),
    won: Number(won?.total ?? 0),
    trends: {
      leads: seeLeads ? trend("leads", "and status != 'Archived'") : null,
      opps: seeOpps ? trend("opportunities") : null,
      wins: seeOpps ? trend("opportunities", "and status = 'won'") : null,
    },
    series: months.map((month) => ({
      label: month.label,
      leads: Number(leadByMonth.find((row) => row.month === month.key)?.count ?? 0),
      opps: Number(oppByMonth.find((row) => row.month === month.key)?.count ?? 0),
    })),
    openRequirements: Number(openRequirements?.count ?? 0),
    candidates: Number(candidates?.count ?? 0),
    openSubmissions: Number(openSubmissions?.count ?? 0),
    overdue: Number(overdue?.count ?? 0),
    meetings,
    dueToday,
    stageBars,
    feed,
    hotLeads,
    closing,
    renewals,
    showRevenue: user.role !== "recruiter" && user.role !== "auditor",
  };
}

type ListOpts = { q?: string; status?: string; sort?: string; page?: number };

function likeTerm(q?: string) {
  return `%${(q ?? "").trim().replace(/[%_]/g, "")}%`;
}

export function leadStatusCounts(user: SessionUser) {
  const sales = ownSales(user, "owner_id");
  return all<{ status: string; count: number }>(
    `select status, count(*) as count from leads
     where tenant_id = ? and ${sales.sql} and status != 'Archived'
     group by status`,
    user.tenantId,
    ...sales.params,
  );
}

export function listLeads(user: SessionUser, opts: ListOpts) {
  const sales = ownSales(user, "l.owner_id");
  const where = [`l.tenant_id = ?`, sales.sql];
  const params: (string | number | null)[] = [user.tenantId, ...sales.params];
  if (opts.status && opts.status !== "all") {
    where.push("l.status = ?");
    params.push(opts.status);
  } else if (!opts.status) {
    where.push("l.status not in ('Archived')");
  }
  if (opts.q) {
    where.push("(l.name like ? or l.first_name like ? or l.last_name like ? or l.company like ? or l.email like ? or l.phone like ? or l.city like ? or l.linkedin_url like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term, term, term, term, term, term, term);
  }
  const sort = opts.sort === "name" ? "l.name collate nocase" : opts.sort === "score" ? "l.score desc" : "l.created_at desc";
  const page = Math.max(1, opts.page || 1);
  const total = one<{ count: number }>(`select count(*) as count from leads l where ${where.join(" and ")}`, ...params);
  const rows = all(
    `select l.*, u.name as owner_name from leads l left join users u on u.id = l.owner_id
     where ${where.join(" and ")} order by ${sort} limit 20 offset ?`,
    ...params,
    (page - 1) * 20,
  );
  return { rows, total: Number(total?.count ?? 0), page };
}

export function getLead(user: SessionUser, id: string) {
  logCrossTenant(user, "leads", id);
  const sales = ownSales(user, "l.owner_id");
  return one<Record<string, unknown>>(
    `select l.*, u.name as owner_name from leads l left join users u on u.id = l.owner_id
     where l.id = ? and l.tenant_id = ? and ${sales.sql}`,
    id,
    user.tenantId,
    ...sales.params,
  );
}

export function findDuplicateLead(tenantId: string, email: string, phone: string, ignoreId?: string) {
  if (email) {
    const byEmail = one<{ id: string; name: string | null; company: string | null }>(
      `select id, name, company from leads where tenant_id = ? and lower(email) = lower(?) and id != ? and status != 'Archived'`,
      tenantId,
      email,
      ignoreId ?? "",
    );
    if (byEmail) return byEmail;
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 8) {
      const rows = all<{ id: string; name: string | null; company: string | null; phone: string | null }>(
        `select id, name, company, phone from leads where tenant_id = ? and id != ? and status != 'Archived' and phone is not null`,
        tenantId,
        ignoreId ?? "",
      );
      return rows.find((row) => (row.phone ?? "").replace(/\D/g, "").endsWith(digits.slice(-8)));
    }
  }
  return undefined;
}

export function listAccounts(user: SessionUser, opts: ListOpts) {
  const where = ["a.tenant_id = ?"];
  const params: (string | number | null)[] = [user.tenantId];
  if (opts.q) {
    where.push("(a.name like ? or a.industry like ? or a.website like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term, term);
  }
  if (opts.status && opts.status !== "all") {
    where.push("a.status = ?");
    params.push(opts.status);
  } else if (!opts.status) {
    where.push("a.status != 'Archived'");
  }
  const total = one<{ count: number }>(`select count(*) as count from accounts a where ${where.join(" and ")}`, ...params);
  const rows = all(
    `select a.*, u.name as owner_name,
        (select coalesce(sum(amount),0) from opportunities o where o.account_id = a.id and o.tenant_id = a.tenant_id and o.status = 'open') as open_pipeline
     from accounts a left join users u on u.id = a.owner_id
     where ${where.join(" and ")} order by a.name limit 20`,
    ...params,
  );
  return { rows, total: Number(total?.count ?? 0) };
}

export function getAccount(user: SessionUser, id: string) {
  logCrossTenant(user, "accounts", id);
  const account = one<Record<string, unknown>>(
    `select a.*, u.name as owner_name from accounts a left join users u on u.id = a.owner_id where a.id = ? and a.tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!account) return null;
  const sales = ownSales(user, "owner_id");
  const contacts = all(`select * from contacts where tenant_id = ? and account_id = ? order by is_primary desc, name`, user.tenantId, id);
  const opportunities = canAccess(user.role, "opportunities")
    ? all(
        `select o.*, s.name as stage_name from opportunities o left join stages s on s.id = o.stage_id
         where o.tenant_id = ? and o.account_id = ? and ${sales.sql} order by o.updated_at desc`,
        user.tenantId,
        id,
        ...sales.params,
      )
    : [];
  const requirements = canAccess(user.role, "requirements")
    ? all(`select id, title, status, positions from requirements where tenant_id = ? and account_id = ?`, user.tenantId, id)
    : [];
  const cases = canAccess(user.role, "cases")
    ? all(`select id, subject, status, priority, sla_due_at from cases where tenant_id = ? and account_id = ?`, user.tenantId, id)
    : [];
  const proposals = canAccess(user.role, "proposals")
    ? all(`select id, name, status, discount_pct from proposals where tenant_id = ? and account_id = ?`, user.tenantId, id)
    : [];
  const contracts = canAccess(user.role, "contracts")
    ? all(`select id, name, status, end_date, value, currency from contracts where tenant_id = ? and account_id = ?`, user.tenantId, id)
    : [];
  const placements = canAccess(user.role, "placements")
    ? all(
        `select p.id, p.role, p.status, p.start_date, c.name as candidate_name from placements p join candidates c on c.id = p.candidate_id where p.tenant_id = ? and p.account_id = ?`,
        user.tenantId,
        id,
      )
    : [];
  const openPipeline = (opportunities as { status?: string; amount?: number }[])
    .filter((row) => row.status === "open")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  return { account, contacts, opportunities, requirements, cases, proposals, contracts, placements, openPipeline };
}

export function listContacts(user: SessionUser, opts: ListOpts) {
  const where = ["c.tenant_id = ?"];
  const params: (string | number | null)[] = [user.tenantId];
  if (opts.q) {
    where.push("(c.name like ? or c.email like ? or c.title like ? or a.name like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term, term, term);
  }
  const rows = all(
    `select c.*, a.name as account_name from contacts c left join accounts a on a.id = c.account_id
     where ${where.join(" and ")} order by c.name limit 40`,
    ...params,
  );
  return rows;
}

export function getContact(user: SessionUser, id: string) {
  logCrossTenant(user, "contacts", id);
  return one<Record<string, unknown>>(
    `select c.*, a.name as account_name from contacts c left join accounts a on a.id = c.account_id
     where c.id = ? and c.tenant_id = ?`,
    id,
    user.tenantId,
  );
}

export function listOpportunities(user: SessionUser, opts: ListOpts & { stage?: string }) {
  const sales = ownSales(user, "o.owner_id");
  const where = [`o.tenant_id = ?`, sales.sql];
  const params: (string | number | null)[] = [user.tenantId, ...sales.params];
  if (opts.status === "open" || !opts.status) {
    where.push("o.status = 'open'");
  } else if (opts.status !== "all") {
    where.push("o.status = ?");
    params.push(opts.status);
  }
  if (opts.q) {
    where.push("(o.name like ? or a.name like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term);
  }
  const rows = all(
    `select o.*, a.name as account_name, u.name as owner_name, s.name as stage_name
     from opportunities o
     left join accounts a on a.id = o.account_id
     left join users u on u.id = o.owner_id
     left join stages s on s.id = o.stage_id
     where ${where.join(" and ")} order by o.close_date limit 50`,
    ...params,
  );
  return rows;
}

export function getOpportunity(user: SessionUser, id: string) {
  logCrossTenant(user, "opportunities", id);
  const sales = ownSales(user, "o.owner_id");
  const opportunity = one<Record<string, unknown>>(
    `select o.*, a.name as account_name, u.name as owner_name, s.name as stage_name, s.kind as stage_kind
     from opportunities o
     left join accounts a on a.id = o.account_id
     left join users u on u.id = o.owner_id
     left join stages s on s.id = o.stage_id
     where o.id = ? and o.tenant_id = ? and ${sales.sql}`,
    id,
    user.tenantId,
    ...sales.params,
  );
  if (!opportunity) return null;
  const history = all(
    `select h.*, u.name as actor_name from stage_history h left join users u on u.id = h.actor_id
     where h.opportunity_id = ? and h.tenant_id = ? order by h.created_at desc`,
    id,
    user.tenantId,
  );
  const proposals = canAccess(user.role, "proposals")
    ? all(`select id, name, status, discount_pct, version_no from proposals where tenant_id = ? and opportunity_id = ?`, user.tenantId, id)
    : [];
  return { opportunity, history, proposals };
}

export function pipelineBoard(user: SessionUser) {
  const sales = ownSales(user, "o.owner_id");
  const stages = stagesFor(user.tenantId);
  const cards = all<{
    id: string;
    name: string;
    amount: number;
    currency: string;
    closeDate: string | null;
    stageId: string;
    accountName: string | null;
    ownerName: string | null;
    version: number;
    probability: number;
  }>(
    `select o.id, o.name, o.amount, o.currency, o.close_date, o.stage_id, o.version, o.probability, a.name as account_name, u.name as owner_name
     from opportunities o
     left join accounts a on a.id = o.account_id
     left join users u on u.id = o.owner_id
     where o.tenant_id = ? and o.status = 'open' and ${sales.sql}`,
    user.tenantId,
    ...sales.params,
  );
  return stages
    .filter((stage) => stage.kind === "open")
    .map((stage) => ({
      ...stage,
      cards: cards.filter((card) => card.stageId === stage.id),
      total: cards.filter((card) => card.stageId === stage.id).reduce((sum, card) => sum + card.amount * (card.probability / 100), 0),
    }));
}

export function listActivities(user: SessionUser, opts: { view?: string; q?: string }) {
  const scope = ownActivity(user, "a.owner_id");
  const where = [`a.tenant_id = ?`, scope.sql];
  const params: (string | number | null)[] = [user.tenantId, ...scope.params];
  if (opts.view === "overdue") {
    where.push("a.type = 'task' and a.status = 'open' and a.due_at < ?");
    params.push(new Date().toISOString());
  } else if (opts.view === "today") {
    where.push("a.status = 'open' and a.due_at <= ?");
    params.push(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
  } else if (opts.view === "completed") {
    where.push("a.status = 'completed'");
  } else {
    where.push("a.status = 'open'");
  }
  if (opts.q) {
    where.push("a.subject like ?");
    params.push(likeTerm(opts.q));
  }
  return all(
    `select a.*, u.name as owner_name from activities a left join users u on u.id = a.owner_id
     where ${where.join(" and ")} order by a.due_at limit 50`,
    ...params,
  );
}

export function timeline(user: SessionUser, relatedType: string, relatedId: string) {
  const events = all<{ id: string; kind: string; title: string; at: string; actor: string | null }>(
    `select id, action as kind, summary as title, created_at as at, actor_id as actor
     from audit_events where tenant_id = ? and record_id = ? order by created_at desc limit 20`,
    user.tenantId,
    relatedId,
  );
  const activity = all<{ id: string; type: string; subject: string; createdAt: string; ownerName: string | null; status: string }>(
    `select a.id, a.type, a.subject, a.created_at, a.status, u.name as owner_name
     from activities a left join users u on u.id = a.owner_id
     where a.tenant_id = ? and a.related_type = ? and a.related_id = ?
     order by a.created_at desc`,
    user.tenantId,
    relatedType,
    relatedId,
  );
  return { events, activity };
}

export function listRequirements(user: SessionUser, opts: ListOpts) {
  const where = ["r.tenant_id = ?"];
  const params: (string | number | null)[] = [user.tenantId];
  if (opts.status && opts.status !== "all") {
    where.push("r.status = ?");
    params.push(opts.status);
  }
  if (opts.q) {
    where.push("(r.title like ? or r.skills like ? or a.name like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term, term);
  }
  return all(
    `select r.*, a.name as account_name, u.name as owner_name,
        (select count(*) from submissions s where s.requirement_id = r.id) as submission_count
     from requirements r
     left join accounts a on a.id = r.account_id
     left join users u on u.id = r.owner_id
     where ${where.join(" and ")} order by r.updated_at desc`,
    ...params,
  );
}

export function getRequirement(user: SessionUser, id: string) {
  logCrossTenant(user, "requirements", id);
  const requirement = one<Record<string, unknown>>(
    `select r.*, a.name as account_name, u.name as owner_name
     from requirements r left join accounts a on a.id = r.account_id left join users u on u.id = r.owner_id
     where r.id = ? and r.tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!requirement) return null;
  const submissions = all(
    `select s.*, c.name as candidate_name from submissions s join candidates c on c.id = s.candidate_id
     where s.tenant_id = ? and s.requirement_id = ? order by s.created_at desc`,
    user.tenantId,
    id,
  );
  return { requirement, submissions: maskRates(user, submissions) };
}

export function listCandidates(user: SessionUser, opts: ListOpts) {
  const where = ["c.tenant_id = ?"];
  const params: (string | number | null)[] = [user.tenantId];
  if (opts.q) {
    where.push("(c.name like ? or c.skills like ? or c.location like ? or c.email like ?)");
    const term = likeTerm(opts.q);
    params.push(term, term, term, term);
  }
  if (opts.status && opts.status !== "all") {
    where.push("c.status = ?");
    params.push(opts.status);
  }
  const rows = all(`select * from candidates c where ${where.join(" and ")} order by c.name`, ...params);
  return maskRates(user, rows);
}

export function getCandidate(user: SessionUser, id: string) {
  logCrossTenant(user, "candidates", id);
  const candidate = one<Record<string, unknown>>(`select * from candidates where id = ? and tenant_id = ?`, id, user.tenantId);
  if (!candidate) return null;
  const submissions = all(
    `select s.id, s.status, s.created_at, r.title as requirement_title, a.name as account_name
     from submissions s join requirements r on r.id = s.requirement_id join accounts a on a.id = r.account_id
     where s.tenant_id = ? and s.candidate_id = ?`,
    user.tenantId,
    id,
  );
  return { candidate: maskRates(user, [candidate])[0], submissions };
}

export function listSubmissions(user: SessionUser) {
  const rows = all(
    `select s.*, c.name as candidate_name, r.title as requirement_title, a.name as account_name, u.name as recruiter_name
     from submissions s
     join candidates c on c.id = s.candidate_id
     join requirements r on r.id = s.requirement_id
     join accounts a on a.id = r.account_id
     left join users u on u.id = s.recruiter_id
     where s.tenant_id = ? order by s.updated_at desc`,
    user.tenantId,
  );
  return maskRates(user, rows);
}

export function getSubmission(user: SessionUser, id: string) {
  logCrossTenant(user, "submissions", id);
  const submission = one<Record<string, unknown>>(
    `select s.*, c.name as candidate_name, r.title as requirement_title, r.status as requirement_status, a.name as account_name
     from submissions s
     join candidates c on c.id = s.candidate_id
     join requirements r on r.id = s.requirement_id
     join accounts a on a.id = r.account_id
     where s.id = ? and s.tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!submission) return null;
  const interviews = all(`select * from interviews where tenant_id = ? and submission_id = ? order by scheduled_at`, user.tenantId, id);
  const history = all(
    `select summary, created_at, action from audit_events where tenant_id = ? and record_id = ? order by created_at desc`,
    user.tenantId,
    id,
  );
  return { submission: maskRates(user, [submission])[0], interviews, history };
}

export function listPlacements(user: SessionUser) {
  const rows = all(
    `select p.*, a.name as account_name, c.name as candidate_name
     from placements p join accounts a on a.id = p.account_id join candidates c on c.id = p.candidate_id
     where p.tenant_id = ? order by p.start_date desc`,
    user.tenantId,
  );
  return rows.map((row) => maskPlacement(user, row));
}

export function listProposals(user: SessionUser) {
  return all(
    `select p.*, a.name as account_name, o.name as opportunity_name
     from proposals p left join accounts a on a.id = p.account_id left join opportunities o on o.id = p.opportunity_id
     where p.tenant_id = ? order by p.updated_at desc`,
    user.tenantId,
  );
}

export function getProposal(user: SessionUser, id: string) {
  logCrossTenant(user, "proposals", id);
  const proposal = one<Record<string, unknown>>(
    `select p.*, a.name as account_name from proposals p left join accounts a on a.id = p.account_id
     where p.id = ? and p.tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!proposal) return null;
  const items = all<{ id: string; description: string; quantity: number; rate: number }>(
    `select id, description, quantity, rate from proposal_items where proposal_id = ? order by position`,
    id,
  );
  return { proposal, items };
}

export function listContracts(user: SessionUser) {
  return all(
    `select c.*, a.name as account_name, u.name as owner_name
     from contracts c left join accounts a on a.id = c.account_id left join users u on u.id = c.owner_id
     where c.tenant_id = ? order by c.end_date`,
    user.tenantId,
  );
}

export function upcomingRenewals(user: SessionUser) {
  return all(
    `select c.*, a.name as account_name from contracts c join accounts a on a.id = c.account_id
     where c.tenant_id = ? and c.status = 'Active' order by c.end_date`,
    user.tenantId,
  );
}

export function listCases(user: SessionUser, opts: ListOpts) {
  const where = ["c.tenant_id = ?"];
  const params: (string | number | null)[] = [user.tenantId];
  if (opts.status && opts.status !== "all") {
    where.push("c.status = ?");
    params.push(opts.status);
  }
  return all(
    `select c.*, a.name as account_name, u.name as owner_name
     from cases c left join accounts a on a.id = c.account_id left join users u on u.id = c.owner_id
     where ${where.join(" and ")} order by c.updated_at desc`,
    ...params,
  );
}

export function getCase(user: SessionUser, id: string) {
  logCrossTenant(user, "cases", id);
  const supportCase = one<Record<string, unknown>>(
    `select c.*, a.name as account_name from cases c left join accounts a on a.id = c.account_id where c.id = ? and c.tenant_id = ?`,
    id,
    user.tenantId,
  );
  if (!supportCase) return null;
  const notes = all(
    `select n.*, u.name as author_name from case_notes n left join users u on u.id = n.author_id where n.case_id = ? order by n.created_at`,
    id,
  );
  return { supportCase, notes };
}

export function listCampaigns(user: SessionUser) {
  return all(`select c.*, u.name as owner_name from campaigns c left join users u on u.id = c.owner_id where c.tenant_id = ?`, user.tenantId);
}

export function campaignDetail(user: SessionUser, id: string) {
  const campaign = one<Record<string, unknown>>(`select * from campaigns where id = ? and tenant_id = ?`, id, user.tenantId);
  if (!campaign) return null;
  const members = all(
    `select m.status, c.name, c.email, c.consent from campaign_members m join contacts c on c.id = m.contact_id where m.campaign_id = ?`,
    id,
  );
  return { campaign, members };
}

export function listNotifications(user: SessionUser) {
  return all(`select * from notifications where tenant_id = ? and user_id = ? order by created_at desc limit 40`, user.tenantId, user.id);
}

export function unreadCount(user: SessionUser) {
  const row = one<{ count: number }>(
    `select count(*) as count from notifications where tenant_id = ? and user_id = ? and read_at is null`,
    user.tenantId,
    user.id,
  );
  return Number(row?.count ?? 0);
}

export function listAudit(user: SessionUser) {
  return all(
    `select e.*, u.name as actor_name from audit_events e left join users u on u.id = e.actor_id
     where e.tenant_id = ? order by e.created_at desc limit 80`,
    user.tenantId,
  );
}

export function listRules(tenantId: string) {
  return all(`select * from workflow_rules where tenant_id = ? order by created_at desc`, tenantId);
}

export function listRuns(tenantId: string) {
  return all(
    `select r.*, w.name as rule_name from workflow_runs r join workflow_rules w on w.id = r.rule_id
     where r.tenant_id = ? order by r.created_at desc limit 30`,
    tenantId,
  );
}

export function searchAll(user: SessionUser, q: string) {
  const term = likeTerm(q);
  if (!q.trim()) return [];
  const results: { type: string; id: string; title: string; meta: string; href: string }[] = [];
  if (canAccess(user.role, "leads")) {
    const sales = ownSales(user, "owner_id");
    const leads = all<{ id: string; name: string | null; company: string | null; status: string }>(
      `select id, name, company, status from leads where tenant_id = ? and ${sales.sql} and (name like ? or first_name like ? or last_name like ? or company like ? or email like ? or city like ?)`,
      user.tenantId,
      ...sales.params,
      term,
      term,
      term,
      term,
      term,
      term,
    );
    for (const lead of leads) {
      results.push({
        type: "Lead",
        id: lead.id,
        title: lead.name || lead.company || "Lead",
        meta: `${lead.company ?? ""} · ${lead.status}`,
        href: `/leads/${lead.id}`,
      });
    }
  }
  if (canAccess(user.role, "accounts")) {
    const accounts = all<{ id: string; name: string; industry: string | null }>(
      `select id, name, industry from accounts where tenant_id = ? and (name like ? or website like ?)`,
      user.tenantId,
      term,
      term,
    );
    for (const account of accounts) {
      results.push({ type: "Account", id: account.id, title: account.name, meta: account.industry ?? "", href: `/accounts/${account.id}` });
    }
  }
  if (canAccess(user.role, "contacts")) {
    const contacts = all<{ id: string; name: string; email: string | null; title: string | null }>(
      `select id, name, email, title from contacts where tenant_id = ? and (name like ? or email like ?)`,
      user.tenantId,
      term,
      term,
    );
    for (const contact of contacts) {
      results.push({
        type: "Contact",
        id: contact.id,
        title: contact.name,
        meta: contact.title ?? contact.email ?? "",
        href: `/contacts/${contact.id}`,
      });
    }
  }
  if (canAccess(user.role, "opportunities")) {
    const sales = ownSales(user, "owner_id");
    const opps = all<{ id: string; name: string; status: string }>(
      `select id, name, status from opportunities where tenant_id = ? and ${sales.sql} and name like ?`,
      user.tenantId,
      ...sales.params,
      term,
    );
    for (const opp of opps) results.push({ type: "Opportunity", id: opp.id, title: opp.name, meta: opp.status, href: `/opportunities/${opp.id}` });
  }
  if (canAccess(user.role, "requirements")) {
    const reqs = all<{ id: string; title: string; status: string }>(
      `select id, title, status from requirements where tenant_id = ? and (title like ? or skills like ?)`,
      user.tenantId,
      term,
      term,
    );
    for (const req of reqs) results.push({ type: "Requirement", id: req.id, title: req.title, meta: req.status, href: `/requirements/${req.id}` });
  }
  if (canAccess(user.role, "candidates")) {
    const candidates = all<{ id: string; name: string; skills: string | null; location: string | null }>(
      `select id, name, skills, location from candidates where tenant_id = ? and (name like ? or skills like ? or location like ?)`,
      user.tenantId,
      term,
      term,
      term,
    );
    for (const candidate of candidates) {
      results.push({
        type: "Candidate",
        id: candidate.id,
        title: candidate.name,
        meta: [candidate.skills, candidate.location].filter(Boolean).join(" · "),
        href: `/candidates/${candidate.id}`,
      });
    }
  }
  if (canAccess(user.role, "cases")) {
    const cases = all<{ id: string; subject: string; status: string }>(
      `select id, subject, status from cases where tenant_id = ? and subject like ?`,
      user.tenantId,
      term,
    );
    for (const item of cases) results.push({ type: "Case", id: item.id, title: item.subject, meta: item.status, href: `/cases/${item.id}` });
  }
  return results.slice(0, 30);
}

export function reports(user: SessionUser) {
  const sales = ownSales(user, "owner_id");
  const leads = one<{ total: number; converted: number }>(
    `select count(*) as total, sum(case when status = 'Converted' then 1 else 0 end) as converted
     from leads where tenant_id = ? and ${sales.sql} and status != 'Archived'`,
    user.tenantId,
    ...sales.params,
  );
  const closed = one<{ won: number; lost: number }>(
    `select sum(case when status = 'won' then 1 else 0 end) as won, sum(case when status = 'lost' then 1 else 0 end) as lost
     from opportunities where tenant_id = ? and ${sales.sql} and status in ('won','lost')`,
    user.tenantId,
    ...sales.params,
  );
  const weighted = one<{ total: number }>(
    `select coalesce(sum(amount * probability / 100.0), 0) as total from opportunities where tenant_id = ? and ${sales.sql} and status = 'open'`,
    user.tenantId,
    ...sales.params,
  );
  const cycle = one<{ days: number }>(
    `select coalesce(avg(julianday(closed_at) - julianday(created_at)), 0) as days
     from opportunities where tenant_id = ? and ${sales.sql} and status = 'won' and closed_at is not null`,
    user.tenantId,
    ...sales.params,
  );
  const activity = one<{ due: number; done: number }>(
    `select count(*) as due, sum(case when status = 'completed' then 1 else 0 end) as done
     from activities where tenant_id = ? and type = 'task'`,
    user.tenantId,
  );
  const subs = one<{ total: number; interviewed: number }>(
    `select count(*) as total,
        sum(case when status in ('Interview','Selected') or id in (select submission_id from interviews) then 1 else 0 end) as interviewed
     from submissions where tenant_id = ?`,
    user.tenantId,
  );
  const placed = one<{ count: number }>(
    `select count(*) as count from placements where tenant_id = ?`,
    user.tenantId,
  );
  const interviewed = Number(subs?.interviewed ?? 0);
  const placements = Number(placed?.count ?? 0);
  const funnel = all<{ status: string; count: number }>(
    `select status, count(*) as count from leads where tenant_id = ? and ${sales.sql} group by status`,
    user.tenantId,
    ...sales.params,
  );
  const months = lastMonths(8);
  const monthStart = `${months[0].key}-01`;
  const revenueRows = all<{ month: string; total: number }>(
    `select substr(coalesce(closed_at, updated_at), 1, 7) as month, coalesce(sum(amount), 0) as total
     from opportunities where tenant_id = ? and ${sales.sql} and status = 'won' and coalesce(closed_at, updated_at) >= ?
     group by month`,
    user.tenantId,
    ...sales.params,
    monthStart,
  );
  const sources = all<{ source: string; count: number }>(
    `select coalesce(nullif(source, ''), 'Other') as source, count(*) as count
     from opportunities where tenant_id = ? and ${sales.sql}
     group by 1 order by 2 desc`,
    user.tenantId,
    ...sales.params,
  );
  const closedAmounts = one<{ wonAmount: number; lostAmount: number }>(
    `select coalesce(sum(case when status = 'won' then amount else 0 end), 0) as won_amount,
            coalesce(sum(case when status = 'lost' then amount else 0 end), 0) as lost_amount
     from opportunities where tenant_id = ? and ${sales.sql} and status in ('won','lost')`,
    user.tenantId,
    ...sales.params,
  );
  const team = all<{ name: string; won: number; amount: number }>(
    `select u.name as name, count(*) as won, coalesce(sum(o.amount), 0) as amount
     from opportunities o join users u on u.id = o.owner_id
     where o.tenant_id = ? and o.status = 'won' and ${sales.sql.split("owner_id").join("o.owner_id")}
     group by u.id order by amount desc`,
    user.tenantId,
    ...sales.params,
  );
  const wonCount = Number(closed?.won ?? 0);
  const wonAmount = Number(closedAmounts?.wonAmount ?? 0);
  return {
    leadConversion: ratio(Number(leads?.converted ?? 0), Number(leads?.total ?? 0)),
    winRate: ratio(Number(closed?.won ?? 0), Number(closed?.won ?? 0) + Number(closed?.lost ?? 0)),
    weighted: Number(weighted?.total ?? 0),
    cycleDays: Math.round(Number(cycle?.days ?? 0)),
    activityCompletion: ratio(Number(activity?.done ?? 0), Number(activity?.due ?? 0)),
    submissionToInterview: ratio(interviewed, Number(subs?.total ?? 0)),
    interviewToPlacement: interviewed ? ratio(placements, interviewed) : 0,
    placements,
    funnel,
    wonAmount,
    lostAmount: Number(closedAmounts?.lostAmount ?? 0),
    wonCount,
    lostCount: Number(closed?.lost ?? 0),
    avgDeal: wonCount ? Math.round(wonAmount / wonCount) : 0,
    revenue: months.map((month) => ({
      label: month.label,
      value: Number(revenueRows.find((row) => row.month === month.key)?.total ?? 0),
    })),
    sources,
    team,
    definitions: [
      ["Lead conversion rate", "Converted leads divided by leads that are not archived."],
      ["Opportunity win rate", "Closed-won opportunities divided by all closed opportunities."],
      ["Weighted pipeline", "Sum of open amount × stage probability. Currency is the tenant base currency."],
      ["Sales cycle", "Average days from opportunity creation to closed-won."],
      ["Activity completion", "Completed tasks divided by all tasks."],
      ["Submission to interview", "Submissions that reached interview or selection, divided by submissions."],
      ["Interview to placement", "Placements divided by submissions that reached interview."],
      ["Placement count", "Placements in this workspace, any status."],
    ] as [string, string][],
  };
}

function ratio(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function changePct(recent: number, prior: number) {
  if (!prior) return recent ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
}

function lastMonths(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (count - 1 - index));
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });
}

function maskRates(user: SessionUser, rows: unknown[]) {
  const records = rows as Record<string, unknown>[];
  if (canSeeCandidateRates(user.role)) return records;
  return records.map((row) => {
    const copy = { ...row };
    delete copy.rateExpectation;
    delete copy.rateMin;
    delete copy.rateMax;
    delete copy.proposedRate;
    delete copy.billRate;
    delete copy.payRate;
    return copy;
  });
}

function maskPlacement(user: SessionUser, row: Record<string, unknown>) {
  const copy = { ...row };
  if (!canSeeCandidateRates(user.role)) {
    delete copy.billRate;
    delete copy.payRate;
  }
  if (canSeeMargin(user.role) && copy.billRate != null && copy.payRate != null && Number(copy.billRate) > 0) {
    copy.marginPct = Math.round(((Number(copy.billRate) - Number(copy.payRate)) / Number(copy.billRate)) * 100);
  }
  return copy;
}

export function tenantBySlug(slug: string) {
  return one<{ id: string; name: string }>(`select id, name from tenants where slug = ?`, slug);
}

export function activeUsersByEmail(email: string) {
  return all<{ id: string; tenantId: string; name: string; email: string; passwordHash: string | null; status: string; mfaEnabled: number; mfaCode: string | null; tenantName: string; mfaRequired: number }>(
    `select u.id, u.tenant_id, u.name, u.email, u.password_hash, u.status, u.mfa_enabled, u.mfa_code, t.name as tenant_name, t.mfa_required
     from users u join tenants t on t.id = u.tenant_id
     where lower(u.email) = lower(?)`,
    email,
  );
}
