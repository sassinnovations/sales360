import Link from "next/link";
import { connection } from "next/server";
import { COLORS, Donut, LineChart } from "@/components/charts";
import { getCurrentUser } from "@/lib/auth";
import { compactMoney, formatWhen, money } from "@/lib/format";
import { canAccess } from "@/lib/permissions";
import { dashboard } from "@/lib/queries";

export const instant = false;

function hello(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Trend({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return <span className={up ? "trend up" : "trend down"}>{up ? "↑" : "↓"} {Math.abs(value)}%</span>;
}

export default async function DashboardPage() {
  await connection();
  const user = await getCurrentUser();
  const data = dashboard(user);
  const sales = canAccess(user.role, "opportunities") || canAccess(user.role, "leads");
  const slices = [
    ...data.stageBars.map((bar, index) => ({ name: bar.name, count: bar.count, color: COLORS[index % COLORS.length] })),
    data.wonCount ? { name: "Closed Won", count: data.wonCount, color: "#22c55e" } : null,
  ].filter((slice): slice is { name: string; count: number; color: string } => Boolean(slice && slice.count > 0));
  const insights = [
    ...data.hotLeads.map((lead) => `${lead.name || lead.company} scores ${lead.score} and is ready for a qualification call.`),
    ...data.closing.map((opp) => `${opp.name} closes ${opp.closeDate?.slice(0, 10)}. Amount ${money(opp.amount, opp.currency)}.`),
    data.overdue ? `${data.overdue} open task${data.overdue === 1 ? "" : "s"} ${data.overdue === 1 ? "is" : "are"} overdue.` : "",
    ...data.renewals.map((item) => `${item.name} for ${item.accountName} ends ${item.endDate?.slice(0, 10)}.`),
  ].filter(Boolean).slice(0, 4);
  const upcoming = [
    ...data.meetings.map((item) => ({ id: item.id, title: item.subject, when: formatWhen(item.dueAt, user.timezone), kind: "Meeting" })),
    ...data.dueToday.map((item) => ({ id: item.id, title: item.subject, when: "Due soon", kind: "Task" })),
  ].slice(0, 4);

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1>{hello(user.timezone)}, {user.name.split(" ")[0]}</h1>
          <p className="lede">Here&apos;s what&apos;s happening with your sales today.</p>
        </div>
      </header>
      {sales ? (
        <section className="grid kpis">
          {canAccess(user.role, "leads") ? (
            <Link href="/leads" className="card kpi">
              <div className="kpi-icon purple">◆</div>
              <div className="kpi-copy"><span>Total leads</span><strong>{data.totalLeads}</strong><Trend value={data.trends.leads} /></div>
            </Link>
          ) : null}
          {canAccess(user.role, "opportunities") ? (
            <Link href="/opportunities" className="card kpi">
              <div className="kpi-icon blue">▣</div>
              <div className="kpi-copy"><span>Open opportunities</span><strong>{data.openOpps}</strong><Trend value={data.trends.opps} /></div>
            </Link>
          ) : null}
          {canAccess(user.role, "pipeline") && data.showRevenue ? (
            <Link href="/pipeline" className="card kpi">
              <div className="kpi-icon teal">◈</div>
              <div className="kpi-copy"><span>Pipeline value</span><strong>{compactMoney(data.pipelineValue, user.currency)}</strong><Trend value={data.trends.opps} /></div>
            </Link>
          ) : null}
          {canAccess(user.role, "opportunities") ? (
            <Link href="/opportunities?status=won" className="card kpi">
              <div className="kpi-icon green">🏆</div>
              <div className="kpi-copy"><span>Wins (closed)</span><strong>{data.wonCount}</strong><Trend value={data.trends.wins} /></div>
            </Link>
          ) : null}
        </section>
      ) : canAccess(user.role, "requirements") ? (
        <section className="grid kpis">
          <Link href="/requirements" className="card kpi"><div className="kpi-icon purple">◆</div><div className="kpi-copy"><span>Open requirements</span><strong>{data.openRequirements}</strong></div></Link>
          <article className="card kpi"><div className="kpi-icon green">✓</div><div className="kpi-copy"><span>Overdue tasks</span><strong>{data.overdue}</strong></div></article>
        </section>
      ) : (
        <section className="grid kpis">
          <article className="card kpi"><div className="kpi-copy"><span>Overdue tasks</span><strong>{data.overdue}</strong></div></article>
        </section>
      )}
      <section className="grid two">
        <article className="card">
          <div className="card-head">
            <h2>Sales performance</h2>
            <div className="legend"><span><i style={{ background: "#7c5cfc" }} />Leads</span><span><i style={{ background: "#93c5fd" }} />Opportunities</span></div>
          </div>
          <LineChart series={data.series} />
        </article>
        <article className="card">
          <div className="card-head"><h2>Opportunity pipeline</h2></div>
          {slices.length ? <Donut slices={slices} center={String(data.openOpps)} caption="Opportunities" /> : <p className="muted">No open opportunities in your scope.</p>}
        </article>
      </section>
      <section className="grid two">
        <article className="card">
          <div className="card-head">
            <h2>Upcoming activities</h2>
            <Link href="/activities">View all</Link>
          </div>
          {upcoming.length === 0 ? <p className="muted">No upcoming meetings or tasks.</p> : null}
          {upcoming.map((item) => (
            <div className="activity" key={item.id}>
              <div className="bubble-icon">{item.kind === "Meeting" ? "▣" : "✓"}</div>
              <div>
                <strong>{item.title}</strong>
                <span className="muted">{item.kind} · {item.when}</span>
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <div className="card-head">
            <h2>AI insights</h2>
            <Link href="/assistant">View details</Link>
          </div>
          {insights.length === 0 ? <p className="muted">Nothing urgent in your scope.</p> : null}
          {insights.map((text) => (
            <div className="insight" key={text}>
              <div className="bubble-icon">✦</div>
              <p style={{ margin: 0 }}>{text}</p>
            </div>
          ))}
        </article>
      </section>
      {sales && canAccess(user.role, "requirements") ? (
        <section className="grid kpis">
          <Link href="/requirements" className="card kpi"><div className="kpi-copy"><span>Open requirements</span><strong>{data.openRequirements}</strong></div></Link>
          <article className="card kpi"><div className="kpi-copy"><span>Overdue tasks</span><strong>{data.overdue}</strong></div></article>
        </section>
      ) : null}
    </div>
  );
}
