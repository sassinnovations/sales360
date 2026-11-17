import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader } from "@/components/ui";
import { saveOpportunity } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen, money } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, getOpportunity, settingList, stagesFor, timeline, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function OpportunityDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "opportunities")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getOpportunity(user, id);
  if (!data) notFound();
  const opp = data.opportunity;
  const sp = await searchParams;
  const history = timeline(user, "opportunity", id);
  const stages = stagesFor(user.tenantId);
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Opportunity"
        title={String(opp.name)}
        action={canWrite(user.role, "opportunities") ? <Link className="btn-ghost" href={`/opportunities/${id}?edit=1`}>Edit</Link> : null}
      />
      <Notice text={q(sp.notice)} />
      <article className="card stack">
        <p><Link href={`/accounts/${opp.accountId}`}>{String(opp.accountName)}</Link> · {String(opp.stageName)} · {money(Number(opp.amount), String(opp.currency))}</p>
        <p>Probability {String(opp.probability)}% · Weighted {money(Number(opp.amount) * Number(opp.probability) / 100, String(opp.currency))}</p>
        <p>Close {String(opp.closeDate ?? "").slice(0, 10)} · Owner {String(opp.ownerName)} · {String(opp.serviceLine ?? "")}</p>
        {opp.lostReason ? <p>Lost reason: {String(opp.lostReason)}</p> : null}
      </article>
      {q(sp.edit) === "1" && canWrite(user.role, "opportunities") ? (
        <EntityForm
          action={saveOpportunity}
          submitLabel="Save opportunity"
          hidden={{ id, version: String(opp.version) }}
          fields={[
            { name: "name", label: "Name", defaultValue: String(opp.name) },
            { name: "accountId", label: "Account", type: "select", defaultValue: String(opp.accountId), options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: String(opp.ownerId ?? ""), options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "stageId", label: "Stage", type: "select", defaultValue: String(opp.stageId), options: stages.map((stage) => ({ value: stage.id, label: stage.name })) },
            { name: "amount", label: "Amount", type: "number", defaultValue: String(opp.amount) },
            { name: "currency", label: "Currency", defaultValue: String(opp.currency) },
            { name: "closeDate", label: "Expected close", type: "date", defaultValue: String(opp.closeDate ?? "").slice(0, 10) },
            { name: "serviceLine", label: "Service line", type: "select", defaultValue: String(opp.serviceLine ?? ""), options: settingList(user.tenantId, "service_lines", []).map((item) => ({ value: item, label: item })) },
            { name: "lostReason", label: "Lost reason", type: "select", defaultValue: String(opp.lostReason ?? ""), options: settingList(user.tenantId, "lost_reasons", []).map((item) => ({ value: item, label: item })) },
            { name: "competitors", label: "Competitors", defaultValue: String(opp.competitors ?? ""), wide: true },
          ]}
        />
      ) : null}
      <article className="card stack">
        <h2>Stage history</h2>
        {data.history.map((row) => {
          const item = row as { id: string; fromStage: string | null; toStage: string; actorName: string | null; createdAt: string };
          return <p key={item.id}>{item.fromStage ?? "Created"} → {item.toStage} · {item.actorName} · {formatWhen(item.createdAt, user.timezone)}</p>;
        })}
      </article>
      <article className="card stack">
        <h2>Proposals</h2>
        {data.proposals.map((row) => {
          const item = row as { id: string; name: string; status: string; versionNo: number };
          return <p key={item.id}><Link href={`/proposals/${item.id}`}>{item.name}</Link> · {item.status} · v{item.versionNo}</p>;
        })}
        {canWrite(user.role, "proposals") ? <Link href={`/proposals?new=1&opportunity=${id}&account=${opp.accountId}`}>New proposal</Link> : null}
      </article>
      <article className="card stack">
        <h2>Activity</h2>
        {history.activity.map((item) => <p key={item.id}>{item.type}: {item.subject} · {item.status}</p>)}
      </article>
    </div>
  );
}
