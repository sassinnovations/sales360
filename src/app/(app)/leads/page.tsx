import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveLead } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, initials } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { leadStatusCounts, listLeads, settingList, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "leads")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const status = q(sp.status);
  const data = listLeads(user, { q: q(sp.q), status, sort: q(sp.sort), page: Number(q(sp.page) || 1) });
  const sources = settingList(user.tenantId, "lead_sources", []);
  const people = usersInTenant(user.tenantId);
  const counts = leadStatusCounts(user);
  const countOf = (name: string) => Number(counts.find((row) => row.status === name)?.count ?? 0);
  const total = counts.reduce((sum, row) => sum + Number(row.count), 0);
  const chips = [
    ["", "All", total],
    ["New", "New", countOf("New")],
    ["Qualified", "Qualified", countOf("Qualified")],
    ["Working", "In Progress", countOf("Working")],
    ["Converted", "Converted", countOf("Converted")],
  ] as const;
  const query = q(sp.q);
  return (
    <div className="stack">
      <PageHeader
        title="Leads"
        action={canWrite(user.role, "leads") ? <Link className="btn-primary" href="/leads?new=1">+ Add lead</Link> : null}
      />
      <Notice text={q(sp.notice)} />
      <div className="toolbar">
        <form action="/leads">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input name="q" placeholder="Search leads..." defaultValue={query} aria-label="Search leads" />
          <select name="sort" defaultValue={q(sp.sort) || "created"} aria-label="Sort">
            <option value="created">Newest</option>
            <option value="score">Score</option>
            <option value="name">Name</option>
          </select>
          <button className="btn-ghost">Filter</button>
        </form>
      </div>
      <nav className="chips">
        {chips.map(([value, label, count]) => {
          const params = new URLSearchParams();
          if (query) params.set("q", query);
          if (value) params.set("status", value);
          const href = params.size ? `/leads?${params}` : "/leads";
          const on = (value || "") === (status || "");
          return <Link key={label} className={on ? "on" : ""} href={href}>{label} ({count})</Link>;
        })}
      </nav>
      {q(sp.new) === "1" && canWrite(user.role, "leads") ? (
        <EntityForm
          action={saveLead}
          submitLabel="Create lead"
          fields={[
            { name: "name", label: "Person", required: true },
            { name: "company", label: "Company" },
            { name: "title", label: "Title" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone" },
            { name: "source", label: "Source", type: "select", options: sources.map((item) => ({ value: item, label: item })) },
            { name: "status", label: "Status", type: "select", defaultValue: "New", options: ["New", "Working", "Qualified", "Unqualified"].map((item) => ({ value: item, label: item })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: people.map((person) => ({ value: person.id, label: person.name })) },
            { name: "notes", label: "Notes", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Lead", "Company", "Email", "Status", "Score", "Owner", "Created"].map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={7}>No leads match this view.</td></tr>
            ) : (
              data.rows.map((row) => {
                const lead = row as Record<string, string | number | null>;
                const label = lead.status === "Working" ? "In Progress" : String(lead.status);
                const owner = String(lead.ownerName || "—");
                return (
                  <tr key={String(lead.id)}>
                    <td><Link href={`/leads/${lead.id}`}><strong>{lead.name || "—"}</strong></Link></td>
                    <td>{lead.company || "—"}</td>
                    <td className="muted">{lead.email || "—"}</td>
                    <td><Pill value={label} /></td>
                    <td className="score">{lead.score}</td>
                    <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><span className="avatar sm">{owner === "—" ? "?" : initials(owner)}</span>{owner}</span></td>
                    <td>{formatDate(String(lead.createdAt ?? ""), user.timezone)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">{data.total} leads in this view.</p>
    </div>
  );
}
