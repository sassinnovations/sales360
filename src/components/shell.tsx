"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/actions/auth";
import type { NavItem } from "@/lib/permissions";
import { roleLabel } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

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
  const groups = [...new Set(nav.map((item) => item.group))];
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="mark">360</div>
          <div>
            <strong>AI Sales360</strong>
            <span>{user.tenantName}</span>
          </div>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group}>
              <p className="nav-label">{group}</p>
              {nav
                .filter((item) => item.group === group)
                .map((item) => (
                  <Link
                    key={`${item.group}-${item.label}`}
                    href={item.href}
                    className="nav-link"
                    aria-current={pathname === item.href ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="who">
          <strong>{user.name}</strong>
          <span>{roleLabel(user.role)}</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="btn-ghost menu" type="button" onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
          <form className="search" action="/search">
            <input name="q" placeholder="Search leads, accounts, people, requirements" aria-label="Search the workspace" />
          </form>
          <Link className="btn-ghost" href="/notifications">
            Alerts{unread ? ` (${unread})` : ""}
          </Link>
          <form action={logout}>
            <button className="btn-ghost">Sign out</button>
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
