import type { Role, SessionUser } from "./types";

const GRANTS: Record<Role, "*" | string[]> = {
  owner: "*",
  admin: "*",
  manager: [
    "dashboard",
    "tasks",
    "leads",
    "accounts",
    "contacts",
    "opportunities",
    "pipeline",
    "activities",
    "campaigns",
    "requirements",
    "candidates",
    "submissions",
    "placements",
    "proposals",
    "contracts",
    "cases",
    "renewals",
    "reports",
    "assistant",
    "search",
    "notifications",
  ],
  bdm: [
    "dashboard",
    "tasks",
    "leads",
    "accounts",
    "contacts",
    "opportunities",
    "pipeline",
    "activities",
    "campaigns",
    "proposals",
    "cases",
    "renewals",
    "reports",
    "assistant",
    "search",
    "notifications",
  ],
  recruiter: [
    "dashboard",
    "tasks",
    "accounts",
    "contacts",
    "requirements",
    "candidates",
    "submissions",
    "placements",
    "activities",
    "assistant",
    "search",
    "notifications",
  ],
  delivery: [
    "dashboard",
    "tasks",
    "accounts",
    "contacts",
    "placements",
    "cases",
    "renewals",
    "activities",
    "assistant",
    "search",
    "notifications",
  ],
  finance: [
    "dashboard",
    "accounts",
    "contacts",
    "proposals",
    "contracts",
    "reports",
    "renewals",
    "search",
    "notifications",
  ],
  auditor: [
    "dashboard",
    "tasks",
    "leads",
    "accounts",
    "contacts",
    "opportunities",
    "pipeline",
    "activities",
    "campaigns",
    "requirements",
    "candidates",
    "submissions",
    "placements",
    "proposals",
    "contracts",
    "cases",
    "renewals",
    "reports",
    "audit",
    "assistant",
    "search",
    "notifications",
  ],
};

export function canAccess(role: Role, module: string) {
  const grant = GRANTS[role];
  if (grant === "*") return true;
  return grant.includes(module);
}

export function canWrite(role: Role, module: string) {
  if (!canAccess(role, module)) return false;
  if (role === "auditor") return false;
  if (role === "finance") return module === "proposals" || module === "contracts";
  if (role === "recruiter") {
    return [
      "requirements",
      "candidates",
      "submissions",
      "placements",
      "activities",
      "tasks",
      "accounts",
      "contacts",
    ].includes(module);
  }
  if (role === "delivery") {
    return ["placements", "cases", "activities", "tasks", "accounts"].includes(module);
  }
  if (role === "bdm") {
    return [
      "leads",
      "accounts",
      "contacts",
      "opportunities",
      "pipeline",
      "activities",
      "tasks",
      "proposals",
      "cases",
      "campaigns",
    ].includes(module);
  }
  if (role === "manager") return true;
  return role === "owner" || role === "admin";
}

export function canApprove(role: Role) {
  return role === "owner" || role === "admin" || role === "manager" || role === "finance";
}

export function canSeeCandidateRates(role: Role) {
  return role === "owner" || role === "admin" || role === "manager" || role === "recruiter" || role === "finance";
}

export function canSeeMargin(role: Role) {
  return role === "owner" || role === "admin" || role === "manager" || role === "finance";
}

export function canExport(role: Role) {
  return role !== "auditor" && role !== "delivery";
}

export function limitsOwnSales(user: SessionUser) {
  return user.role === "bdm";
}

const RANK: Record<Role, number> = {
  auditor: 1,
  finance: 2,
  delivery: 2,
  recruiter: 2,
  bdm: 2,
  manager: 3,
  admin: 4,
  owner: 5,
};

export function canGrantRole(actor: Role, target: Role) {
  return RANK[actor] >= RANK[target] && (actor === "owner" || target !== "owner");
}

export type NavItem = { group: string; href: string; label: string; module: string };

export const NAV: NavItem[] = [
  { group: "Workspace", href: "/dashboard", label: "My Dashboard", module: "dashboard" },
  { group: "Workspace", href: "/activities", label: "My Tasks", module: "tasks" },
  { group: "Workspace", href: "/notifications", label: "Notifications", module: "notifications" },
  { group: "Workspace", href: "/assistant", label: "AI Assistant", module: "assistant" },
  { group: "Sales CRM", href: "/leads", label: "Leads", module: "leads" },
  { group: "Sales CRM", href: "/accounts", label: "Accounts", module: "accounts" },
  { group: "Sales CRM", href: "/contacts", label: "Contacts", module: "contacts" },
  { group: "Sales CRM", href: "/opportunities", label: "Opportunities", module: "opportunities" },
  { group: "Sales CRM", href: "/pipeline", label: "Pipeline", module: "pipeline" },
  { group: "Sales CRM", href: "/activities", label: "Activities", module: "activities" },
  { group: "Business Development", href: "/campaigns", label: "Campaigns", module: "campaigns" },
  { group: "Business Development", href: "/requirements", label: "Client Requirements", module: "requirements" },
  { group: "Business Development", href: "/proposals", label: "Proposals", module: "proposals" },
  { group: "Business Development", href: "/contracts", label: "Contracts", module: "contracts" },
  { group: "Staffing & Delivery", href: "/candidates", label: "Candidates", module: "candidates" },
  { group: "Staffing & Delivery", href: "/submissions", label: "Submissions", module: "submissions" },
  { group: "Staffing & Delivery", href: "/placements", label: "Placements", module: "placements" },
  { group: "Customer Management", href: "/accounts", label: "Customer 360", module: "accounts" },
  { group: "Customer Management", href: "/cases", label: "Support Cases", module: "cases" },
  { group: "Customer Management", href: "/renewals", label: "Renewals", module: "renewals" },
  { group: "Analytics", href: "/reports", label: "Sales Analytics", module: "reports" },
  { group: "Administration", href: "/admin", label: "Tenant Settings", module: "admin" },
  { group: "Administration", href: "/admin/users", label: "Users & Roles", module: "admin" },
  { group: "Administration", href: "/admin/workflows", label: "Workflow Rules", module: "admin" },
  { group: "Administration", href: "/audit", label: "Audit Logs", module: "audit" },
];

export function navFor(role: Role) {
  return NAV.filter((item) => {
    if (item.module === "admin") return role === "owner" || role === "admin";
    if (item.module === "audit") return canAccess(role, "audit") || role === "owner" || role === "admin";
    return canAccess(role, item.module);
  });
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    owner: "Tenant Owner",
    admin: "Tenant Admin",
    manager: "Sales Manager",
    bdm: "Sales / BDM",
    recruiter: "Recruiter",
    delivery: "Delivery",
    finance: "Finance",
    auditor: "Auditor",
  };
  return labels[role];
}
