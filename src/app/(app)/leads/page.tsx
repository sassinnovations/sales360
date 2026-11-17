import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveLead } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { listLeads, settingList, usersInTenant } from "@/lib/queries";
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
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Sales CRM"
        title="Leads"
        action={canWrite(user.role, "leads") ? <Link className="btn-primary" href="/leads?new=1">New lead</Link> : null}
      />
      <Notice text={q(sp.notice)} />
      <form className="card" action="/leads" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="q" placeholder="Search name, company, email" defaultValue={q(sp.q)} aria-label="Search leads" />
        <select name="status" defaultValue={status} aria-label="Status">
          <option value="">Active</option>
          {["New", "Working", "Qualified", "Unqualified", "Converted", "Archived", "all"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select name="sort" defaultValue={q(sp.sort) || "created"} aria-label="Sort">
          <option value="created">Newest</option>
          <option value="score">Score</option>
          <option value="name">Name</option>
        </select>
        <button className="btn-ghost">Apply</button>
      </form>
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
              {["Name", "Company", "Title", "Email", "Source", "Status", "Owner", "Score", "Created"].map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={9}>No leads match this view.</td></tr>
            ) : (
              data.rows.map((row) => {
                const lead = row as Record<string, string | number | null>;
                return (
                  <tr key={String(lead.id)}>
                    <td><Link href={`/leads/${lead.id}`}>{lead.name || "—"}</Link></td>
                    <td>{lead.company || "—"}</td>
                    <td>{lead.title || "—"}</td>
                    <td>{lead.email || "—"}</td>
                    <td>{lead.source || "—"}</td>
                    <td><Pill value={String(lead.status)} /></td>
                    <td>{lead.ownerName || "—"}</td>
                    <td>{lead.score}</td>
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
