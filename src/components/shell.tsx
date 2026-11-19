"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/actions/auth";
import type { NavItem } from "@/lib/permissions";
import { roleLabel } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { initials } from "@/lib/format";
import { Icon } from "./icons";

const ICONS: Record<string, string> = {
  "/dashboard": "dashboard",
  "/leads": "leads",
  "/accounts": "accounts",
  "/contacts": "contacts",
  "/opportunities": "opportunities",
  "/activities": "activities",
  "/requirements": "staffing",
  "/proposals": "proposals",
  "/reports": "reports",
  "/assistant": "assistant",
  "/admin": "admin",
  "/pipeline": "opportunities",
  "/campaigns": "reports",
  "/contracts": "proposals",
  "/candidates": "staffing",
  "/submissions": "staffing",
  "/placements": "staffing",
  "/cases": "contacts",
  "/renewals": "activities",
  "/notifications": "bell",
  "/admin/users": "contacts",
  "/admin/workflows": "settings",
  "/audit": "reports",
};

const TITLES: [string, string][] = [
  ["/admin/users", "Users"],
  ["/admin/workflows", "Workflows"],
  ["/admin", "Admin"],
  ["/dashboard", "Dashboard"],
  ["/leads", "Leads"],
  ["/accounts", "Accounts"],
  ["/contacts", "Contacts"],
  ["/opportunities", "Opportunities"],
  ["/pipeline", "Opportunities"],
  ["/activities", "Activities"],
  ["/requirements", "IT Staffing"],
  ["/candidates", "IT Staffing"],
  ["/submissions", "IT Staffing"],
  ["/placements", "IT Staffing"],
  ["/proposals", "Proposals"],
  ["/contracts", "Contracts"],
  ["/reports", "Reports"],
  ["/assistant", "AI Assistant"],
  ["/campaigns", "Campaigns"],
  ["/cases", "Support cases"],
  ["/renewals", "Renewals"],
  ["/notifications", "Notifications"],
  ["/audit", "Audit logs"],
  ["/search", "Search"],
];

function current(pathname: string, href: string) {
  if (href === "/opportunities") return pathname.startsWith("/opportunities");
  if (href === "/requirements") return pathname.startsWith("/requirements");
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/users") return pathname.startsWith("/admin/users");
  if (href === "/admin/workflows") return pathname.startsWith("/admin/workflows");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  user,
  nav,
  unread,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  unread: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = TITLES.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? "AI Sales360";
  const groups = [...new Set(nav.map((item) => item.group))];

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <div className="mark">A</div>
          <div>
            <strong>AI Sales360</strong>
            <span>CRM</span>
          </div>
        </Link>
        <nav className="nav-scroll">
          {groups.map((group) => (
            <div key={group}>
              {group === "More" ? <p className="nav-label">More</p> : null}
              {nav
                .filter((item) => item.group === group)
                .map((item) => (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className="nav-link"
                    aria-current={current(pathname, item.href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={ICONS[item.href] ?? "dashboard"} />
                    {item.label}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="workspace-card">
          <div className="avatar">{initials(user.tenantName)}</div>
          <div>
            <strong>{user.tenantName}</strong>
            <span>Workspace</span>
          </div>
          <form action={logout}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="top-start">
            <button className="btn-ghost menu" type="button" onClick={() => setOpen((value) => !value)}>
              Menu
            </button>
            <div className="top-title">{title}</div>
          </div>
          <form className="search" action="/search">
            <Icon name="search" />
            <input name="q" placeholder="Search anything..." aria-label="Search the workspace" />
          </form>
          <div className="top-end">
          <span className="range-chip">Last 30 days</span>
          <Link className="icon-btn" href="/notifications" aria-label={unread ? `${unread} unread alerts` : "Alerts"}>
            <Icon name="bell" />
            {unread ? <span className="badge">{unread}</span> : null}
          </Link>
          <details className="profile">
            <summary className="userchip" aria-label="Profile">
              <div className="avatar">{initials(user.name)}</div>
              <div>
                <strong>{user.name}</strong>
                <span>{roleLabel(user.role)}</span>
              </div>
            </summary>
            <div className="profile-menu">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <span>{roleLabel(user.role)}</span>
              <form action={logout}>
                <button className="btn-ghost" type="submit">Sign out</button>
              </form>
            </div>
          </details>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
