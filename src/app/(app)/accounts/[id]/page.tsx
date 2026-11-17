import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader, Pill, Tabs } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { canAccess, canSeeCandidateRates } from "@/lib/permissions";
import { getAccount, timeline } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function AccountDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "accounts")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getAccount(user, id);
  if (!data) notFound();
  const sp = await searchParams;
  const tab = q(sp.tab) || "overview";
  const account = data.account;
  const history = timeline(user, "account", id);
  const tabs = [
    ["overview", "Overview"],
    ["contacts", "Contacts"],
    ["opportunities", "Opportunities"],
    ["requirements", "Requirements"],
    ["commercial", "Proposals & contracts"],
    ["delivery", "Delivery"],
    ["support", "Support"],
    ["timeline", "Timeline"],
  ].filter(([key]) => {
    if (key === "opportunities") return canAccess(user.role, "opportunities");
    if (key === "requirements") return canAccess(user.role, "requirements");
    if (key === "commercial") return canAccess(user.role, "proposals") || canAccess(user.role, "contracts");
    if (key === "delivery") return canAccess(user.role, "placements");
    if (key === "support") return canAccess(user.role, "cases");
    return true;
  });
  return (
    <div className="stack">
      <PageHeader eyebrow="Account 360" title={String(account.name)} />
      <Notice text={q(sp.notice)} />
      <Tabs base={`/accounts/${id}`} current={tab} tabs={tabs.map(([value, label]) => ({ id: value, label }))} />
      {tab === "overview" ? (
        <article className="card stack">
          <p><Pill value={String(account.health ?? "Watch")} /> · {String(account.type)} · {String(account.industry ?? "")}</p>
          <p>{String(account.healthReason ?? "No health reason recorded.")}</p>
          <p>Open pipeline visible to you: {money(data.openPipeline, user.currency)}</p>
          <p>{String(account.website ?? "")} · {String(account.region ?? "")} · Owner {String(account.ownerName ?? "")}</p>
        </article>
      ) : null}
      {tab === "contacts" ? (
        <div className="card stack">
          {data.contacts.map((contact) => {
            const row = contact as { id: string; name: string; title: string | null; email: string | null; consent: string; isPrimary: number };
            return <p key={row.id}><Link href={`/contacts/${row.id}`}>{row.name}</Link> · {row.title} · {row.email} · {row.consent} {row.isPrimary ? "· Primary" : ""}</p>;
          })}
        </div>
      ) : null}
      {tab === "opportunities" ? (
        <div className="card stack">
          {data.opportunities.length === 0 ? <p className="muted">No opportunities in your scope.</p> : null}
          {data.opportunities.map((row) => {
            const opp = row as { id: string; name: string; amount: number; currency: string; status: string; stageName: string };
            return <p key={opp.id}><Link href={`/opportunities/${opp.id}`}>{opp.name}</Link> · {opp.stageName} · {money(opp.amount, opp.currency)} · {opp.status}</p>;
          })}
        </div>
      ) : null}
      {tab === "requirements" ? (
        <div className="card stack">
          {data.requirements.map((row) => {
            const item = row as { id: string; title: string; status: string };
            return <p key={item.id}><Link href={`/requirements/${item.id}`}>{item.title}</Link> · {item.status}</p>;
          })}
        </div>
      ) : null}
      {tab === "commercial" ? (
        <div className="card stack">
          {data.proposals.map((row) => {
            const item = row as { id: string; name: string; status: string };
            return <p key={item.id}><Link href={`/proposals/${item.id}`}>{item.name}</Link> · {item.status}</p>;
          })}
          {data.contracts.map((row) => {
            const item = row as { id: string; name: string; endDate: string; value: number; currency: string };
            return <p key={item.id}>{item.name} ends {formatDate(item.endDate, user.timezone)} · {money(item.value, item.currency)}</p>;
          })}
        </div>
      ) : null}
      {tab === "delivery" ? (
        <div className="card stack">
          {data.placements.map((row) => {
            const item = row as { id: string; role: string; status: string; candidateName: string };
            return <p key={item.id}>{item.candidateName} · {item.role} · {item.status}{canSeeCandidateRates(user.role) ? "" : ""}</p>;
          })}
        </div>
      ) : null}
      {tab === "support" ? (
        <div className="card stack">
          {data.cases.map((row) => {
            const item = row as { id: string; subject: string; status: string; priority: string; slaDueAt: string };
            return <p key={item.id}><Link href={`/cases/${item.id}`}>{item.subject}</Link> · {item.status} · {item.priority} · SLA {formatDate(item.slaDueAt, user.timezone)}</p>;
          })}
        </div>
      ) : null}
      {tab === "timeline" ? (
        <div className="card stack">
          {history.activity.map((item) => <p key={item.id}>{item.type}: {item.subject}</p>)}
          {history.events.map((event) => <p key={event.id}>{event.title}</p>)}
        </div>
      ) : null}
    </div>
  );
}
