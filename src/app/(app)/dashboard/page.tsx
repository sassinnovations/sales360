import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { money, formatWhen } from "@/lib/format";
import { canAccess } from "@/lib/permissions";
import { dashboard } from "@/lib/queries";
import { PageHeader } from "@/components/ui";

export const instant = false;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const data = dashboard(user);
  const max = Math.max(...data.stageBars.map((bar) => bar.amount), 1);
  const cards = [
    canAccess(user.role, "leads") ? ["/leads", "Open leads", String(data.openLeads)] : null,
    canAccess(user.role, "leads") ? ["/leads?status=Qualified", "Qualified", String(data.qualified)] : null,
    canAccess(user.role, "opportunities") ? ["/opportunities", "Open opportunities", String(data.openOpps)] : null,
    canAccess(user.role, "pipeline")
      ? ["/pipeline", "Weighted pipeline", data.showRevenue ? money(data.weighted, user.currency) : "Hidden"]
      : null,
    canAccess(user.role, "activities") ? ["/activities?view=overdue", "Overdue tasks", String(data.overdue)] : null,
    canAccess(user.role, "opportunities")
      ? ["/opportunities?status=won", "Won revenue", data.showRevenue ? money(data.won, user.currency) : "Hidden"]
      : null,
    canAccess(user.role, "requirements") ? ["/requirements", "Open requirements", String(data.openRequirements)] : null,
    canAccess(user.role, "candidates") ? ["/candidates", "Candidates", String(data.candidates)] : null,
    canAccess(user.role, "submissions") ? ["/submissions", "Open submissions", String(data.openSubmissions)] : null,
  ].filter((card): card is [string, string, string] => card !== null);
  return (
    <div className="stack">
      <PageHeader eyebrow={user.tenantName} title={`Good to see you, ${user.name.split(" ")[0]}.`} />
      <section className="grid kpis">
        {cards.map(([href, label, value]) => (
          <Link key={label} href={href} className="card kpi">
            <span>{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </section>
      <section className="grid two">
        <article className="card stack">
          <h2>{canAccess(user.role, "opportunities") ? "Pipeline by stage" : "Delivery snapshot"}</h2>
          {canAccess(user.role, "opportunities") && data.stageBars.every((bar) => bar.count === 0) ? (
            <p className="muted">No open opportunities match your access.</p>
          ) : null}
          {!canAccess(user.role, "opportunities") ? (
            <p className="muted">Sales pipeline stays with the roles that own it. Your counts are the requirements and candidates in this workspace.</p>
          ) : null}
          {data.stageBars.map((bar) => (
            <div key={bar.name}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{bar.name}</span>
                <span>{bar.count} · {data.showRevenue ? money(bar.amount, user.currency) : ""}</span>
              </div>
              <div className="bar"><span style={{ width: `${(bar.amount / max) * 100}%` }} /></div>
            </div>
          ))}
        </article>
        <article className="card stack">
          <h2>Recommended next</h2>
          {data.dueToday.map((task) => (
            <p key={task.id}>Task due: {task.subject}. It is still open, so it stays on the list.</p>
          ))}
          {data.hotLeads.map((lead) => (
            <p key={lead.id}>
              <Link href={`/leads/${lead.id}`}>{lead.name || lead.company}</Link> scores {lead.score} because the profile and recent status support a conversation.
            </p>
          ))}
          {data.closing.map((opp) => (
            <p key={opp.id}>
              <Link href={`/opportunities/${opp.id}`}>{opp.name}</Link> closes {opp.closeDate?.slice(0, 10)}. Amount {money(opp.amount, opp.currency)}.
            </p>
          ))}
          {data.renewals.map((item) => (
            <p key={item.id}>
              <Link href="/renewals">{item.name}</Link> for {item.accountName} ends {item.endDate?.slice(0, 10)}.
            </p>
          ))}
          {!data.dueToday.length && !data.hotLeads.length && !data.closing.length ? <p className="muted">Nothing urgent in your scope.</p> : null}
        </article>
      </section>
      <section className="grid two">
        <article className="card">
          <h2>Upcoming meetings</h2>
          {data.meetings.length === 0 ? <p className="muted">No upcoming meetings.</p> : null}
          {data.meetings.map((meeting) => (
            <p key={meeting.id}>{meeting.subject} · {formatWhen(meeting.dueAt, user.timezone)}</p>
          ))}
        </article>
        <article className="card">
          <h2>Recent activity</h2>
          {data.feed.map((item) => (
            <p key={item.id}>{item.type}: {item.subject} · {item.ownerName}</p>
          ))}
        </article>
      </section>
    </div>
  );
}
