import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { BoardToggle } from "@/components/section-nav";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveOpportunity } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listContacts, listOpportunities, settingList, stagesFor, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "opportunities")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listOpportunities(user, { q: q(sp.q), status: q(sp.status) || "open" });
  const stages = stagesFor(user.tenantId);
  const contacts = listContacts(user, {});
  return (
    <div className="stack">
      <PageHeader title="Opportunities" action={<BoardToggle current="list" />} />
      <Notice text={q(sp.notice)} />
      <form className="card" action="/opportunities" style={{ display: "flex", gap: 8 }}>
        <input name="q" placeholder="Search" defaultValue={q(sp.q)} aria-label="Search opportunities" />
        <select name="status" defaultValue={q(sp.status) || "open"} aria-label="Status">
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="all">All</option>
        </select>
        <button className="btn-ghost">Apply</button>
      </form>
      {q(sp.new) === "1" && canWrite(user.role, "opportunities") ? (
        <EntityForm
          action={saveOpportunity}
          submitLabel="Create opportunity"
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "accountId", label: "Account", type: "select", required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "contactId", label: "Primary contact", type: "select", options: contacts.map((contact) => ({ value: String((contact as { id: string }).id), label: String((contact as { name: string }).name) })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "stageId", label: "Stage", type: "select", required: true, options: stages.map((stage) => ({ value: stage.id, label: stage.name })) },
            { name: "amount", label: "Amount", type: "number", required: true },
            { name: "currency", label: "Currency", defaultValue: user.currency },
            { name: "closeDate", label: "Expected close", type: "date", required: true },
            { name: "serviceLine", label: "Service line", type: "select", options: settingList(user.tenantId, "service_lines", []).map((item) => ({ value: item, label: item })) },
            { name: "source", label: "Source", type: "select", options: settingList(user.tenantId, "lead_sources", []).map((item) => ({ value: item, label: item })) },
            { name: "lostReason", label: "Lost reason, if closing lost", type: "select", options: settingList(user.tenantId, "lost_reasons", []).map((item) => ({ value: item, label: item })) },
            { name: "competitors", label: "Competitors", wide: true },
          ]}
        />
      ) : canWrite(user.role, "opportunities") ? <Link href="/opportunities?new=1">New opportunity</Link> : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Opportunity", "Account", "Stage", "Amount", "Weighted", "Close", "Owner"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7}>No opportunities in this view.</td></tr> : rows.map((row) => {
              const opp = row as Record<string, string | number | null>;
              return (
                <tr key={String(opp.id)}>
                  <td><Link href={`/opportunities/${opp.id}`}>{opp.name}</Link></td>
                  <td>{opp.accountName}</td>
                  <td><Pill value={String(opp.stageName ?? opp.status)} /></td>
                  <td>{money(Number(opp.amount), String(opp.currency))}</td>
                  <td>{money(Number(opp.amount) * Number(opp.probability) / 100, String(opp.currency))}</td>
                  <td>{formatDate(String(opp.closeDate ?? ""), user.timezone)}</td>
                  <td>{opp.ownerName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
