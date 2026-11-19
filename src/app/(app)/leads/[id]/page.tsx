import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { convertLead, saveLead } from "@/lib/actions/crm";
import { saveScoreFeedback } from "@/lib/actions/assistant";
import { getCurrentUser } from "@/lib/auth";
import { band, formatWhen } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, getLead, settingList, stagesFor, timeline, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function LeadDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "leads")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const lead = getLead(user, id);
  if (!lead) notFound();
  const sp = await searchParams;
  const reasons = JSON.parse(String(lead.scoreReasons || "[]")) as string[];
  const history = timeline(user, "lead", id);
  const people = usersInTenant(user.tenantId);
  const sources = settingList(user.tenantId, "lead_sources", []);
  const accounts = accountsFor(user);
  const stage = stagesFor(user.tenantId).find((item) => item.kind === "open");
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Lead"
        title={String(lead.name || lead.company)}
        action={
          <span style={{ display: "flex", gap: 8 }}>
            {canWrite(user.role, "leads") && lead.status !== "Converted" ? <Link className="btn-ghost" href={`/leads/${id}?edit=1`}>Edit</Link> : null}
            {canWrite(user.role, "leads") && lead.status !== "Converted" ? <Link className="btn-primary" href={`/leads/${id}?convert=1`}>Convert</Link> : null}
          </span>
        }
      />
      <Notice text={q(sp.notice)} />
      <section className="grid two">
        <article className="card stack">
          <p><Pill value={String(lead.status)} /> · {String(lead.source || "No source")} · Owner {String(lead.ownerName ?? "—")}</p>
          <p>{String(lead.title ?? "")} {lead.company ? `at ${lead.company}` : ""}</p>
          <p>{String(lead.email ?? "No email")} · {lead.phone ? String(lead.phone) : "No mobile number"}</p>
          {lead.linkedinUrl ? <p><a href={String(lead.linkedinUrl).startsWith("http") ? String(lead.linkedinUrl) : `https://${lead.linkedinUrl}`}>LinkedIn</a></p> : null}
          <p>{[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "No location"}</p>
          <p>{String(lead.notes ?? "")}</p>
          {lead.convertedAt ? (
            <p>
              Converted. <Link href={`/accounts/${lead.accountId}`}>Account</Link>
              {lead.contactId ? <> · <Link href={`/contacts/${lead.contactId}`}>Contact</Link></> : null}
              {lead.opportunityId ? <> · <Link href={`/opportunities/${lead.opportunityId}`}>Opportunity</Link></> : null}
            </p>
          ) : null}
        </article>
        <article className="card stack">
          <h2>Score {String(lead.score)} · {band(Number(lead.score))}</h2>
          <p className="muted">Advisory only. Refreshed {formatWhen(String(lead.scoreUpdatedAt ?? ""), user.timezone)}. Missing data is called out instead of treated as a negative.</p>
          <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <form action={saveScoreFeedback} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="id" value={id} />
            <input name="reason" placeholder="Why was this useful or not?" aria-label="Score feedback" />
            <button className="btn-ghost" name="useful" value="yes">Useful</button>
            <button className="btn-ghost" name="useful" value="no">Not useful</button>
          </form>
        </article>
      </section>
      {q(sp.edit) === "1" ? (
        <EntityForm
          action={saveLead}
          submitLabel="Save lead"
          hidden={{ id, version: String(lead.version) }}
          fields={[
            { name: "firstName", label: "First name", required: true, defaultValue: String(lead.firstName ?? String(lead.name ?? "").split(" ")[0] ?? "") },
            { name: "lastName", label: "Last name", required: true, defaultValue: String(lead.lastName ?? String(lead.name ?? "").split(" ").slice(1).join(" ")) },
            { name: "company", label: "Company", defaultValue: String(lead.company ?? "") },
            { name: "title", label: "Title", defaultValue: String(lead.title ?? "") },
            { name: "email", label: "Email", defaultValue: String(lead.email ?? "") },
            { name: "phone", label: "Mobile number", defaultValue: String(lead.phone ?? "") },
            { name: "linkedinUrl", label: "LinkedIn URL", wide: true, defaultValue: String(lead.linkedinUrl ?? "") },
            { name: "city", label: "City", defaultValue: String(lead.city ?? "") },
            { name: "state", label: "State", defaultValue: String(lead.state ?? "") },
            { name: "country", label: "Country", defaultValue: String(lead.country ?? "") },
            { name: "source", label: "Source", type: "select", defaultValue: String(lead.source ?? ""), options: sources.map((item) => ({ value: item, label: item })) },
            { name: "status", label: "Status", type: "select", defaultValue: String(lead.status), options: ["New", "Working", "Qualified", "Unqualified", "Archived"].map((item) => ({ value: item, label: item })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: String(lead.ownerId ?? ""), options: people.map((person) => ({ value: person.id, label: person.name })) },
            { name: "notes", label: "Notes", type: "textarea", wide: true, defaultValue: String(lead.notes ?? "") },
          ]}
        />
      ) : null}
      {q(sp.convert) === "1" ? (
        <EntityForm
          action={convertLead}
          submitLabel="Convert lead"
          hidden={{ id }}
          fields={[
            { name: "need", label: "Need", required: true, wide: true },
            { name: "budget", label: "Budget" },
            { name: "authority", label: "Authority" },
            { name: "timelineNote", label: "Timeline", required: true },
            { name: "fit", label: "Fit" },
            { name: "serviceInterest", label: "Service interest" },
            { name: "accountMode", label: "Account", type: "select", defaultValue: "new", options: [{ value: "new", label: "Create new" }, { value: "existing", label: "Match existing" }] },
            { name: "accountName", label: "New account name", defaultValue: String(lead.company ?? "") },
            { name: "accountId", label: "Existing account", type: "select", options: accounts.map((account) => ({ value: account.id, label: account.name })) },
            { name: "createOpportunity", label: "Also create an opportunity", type: "checkbox", defaultValue: "yes" },
            { name: "opportunityName", label: "Opportunity", defaultValue: `${lead.company ?? lead.name} opportunity` },
            { name: "amount", label: "Amount", type: "number", defaultValue: "0" },
            { name: "closeDate", label: "Expected close", type: "date" },
          ]}
        />
      ) : null}
      <article className="card">
        <h2>Timeline</h2>
        {history.activity.length === 0 && history.events.length === 0 ? <p className="muted">No interactions yet.</p> : null}
        {history.activity.map((item) => (
          <p key={item.id}>{item.type}: {item.subject} · {item.ownerName} · {formatWhen(item.createdAt, user.timezone)} · {item.status}</p>
        ))}
        {history.events.map((event) => (
          <p key={event.id}>{event.title} · {formatWhen(event.at, user.timezone)}</p>
        ))}
      </article>
      {stage ? null : null}
    </div>
  );
}
