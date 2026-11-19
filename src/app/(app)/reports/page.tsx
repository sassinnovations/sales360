import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Bars, COLORS, Donut } from "@/components/charts";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { compactMoney, money } from "@/lib/format";
import { canAccess, canExport } from "@/lib/permissions";
import { reports } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

const TABS = [
  ["sales", "Sales overview"],
  ["leads", "Lead analysis"],
  ["winloss", "Win / loss"],
  ["team", "Team performance"],
  ["staffing", "Staffing reports"],
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getCurrentUser();
  if (!canAccess(user.role, "reports")) redirect("/dashboard?notice=You do not have access to that area");
  const tab = q((await searchParams).tab) || "sales";
  const data = reports(user);
  const max = Math.max(...data.funnel.map((row) => Number(row.count)), 1);
  const sources = data.sources.map((row, index) => ({
    name: row.source,
    count: Number(row.count),
    color: COLORS[index % COLORS.length],
  }));
  return (
    <div className="stack">
      <PageHeader
        title="Reports"
        action={canExport(user.role) ? <a className="btn-primary" href="/api/reports/pipeline">Export</a> : <span className="muted">Export is off for this role</span>}
      />
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <Link key={id} className={tab === id ? "on" : ""} href={id === "sales" ? "/reports" : `/reports?tab=${id}`}>{label}</Link>
        ))}
      </nav>
      {tab === "leads" ? (
        <article className="card stack">
          <h2>Lead funnel</h2>
          <p className="muted">Conversion rate {data.leadConversion}%.</p>
          {data.funnel.map((row) => (
            <div key={row.status}>
              <Link href={`/leads?status=${row.status}`}>{row.status}</Link> · {row.count}
              <div className="bar"><span style={{ width: `${(Number(row.count) / max) * 100}%` }} /></div>
            </div>
          ))}
        </article>
      ) : null}
      {tab === "winloss" ? (
        <section className="grid kpis">
          <article className="card kpi"><div className="kpi-copy"><span>Won</span><strong>{data.wonCount}</strong><span>{compactMoney(data.wonAmount, user.currency)}</span></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Lost</span><strong>{data.lostCount}</strong><span>{compactMoney(data.lostAmount, user.currency)}</span></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Win rate</span><strong>{data.winRate}%</strong></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Weighted pipeline</span><strong>{compactMoney(data.weighted, user.currency)}</strong></div></article>
        </section>
      ) : null}
      {tab === "team" ? (
        <div className="table-wrap">
          <table>
            <thead><tr>{["Owner", "Wins", "Revenue"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
            <tbody>
              {data.team.length === 0 ? <tr><td colSpan={3}>No closed-won deals yet.</td></tr> : data.team.map((row) => (
                <tr key={row.name}><td>{row.name}</td><td>{row.won}</td><td>{money(Number(row.amount), user.currency)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {tab === "staffing" ? (
        <section className="grid kpis">
          <article className="card kpi"><div className="kpi-copy"><span>Submission → interview</span><strong>{data.submissionToInterview}%</strong></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Interview → placement</span><strong>{data.interviewToPlacement}%</strong></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Placements</span><strong>{data.placements}</strong></div></article>
          <article className="card kpi"><div className="kpi-copy"><span>Activity completion</span><strong>{data.activityCompletion}%</strong></div></article>
        </section>
      ) : null}
      {tab === "sales" ? (
        <>
          <section className="grid kpis">
            <article className="card kpi"><div className="kpi-copy"><span>Sales revenue</span><strong>{compactMoney(data.wonAmount, user.currency)}</strong></div></article>
            <article className="card kpi"><div className="kpi-copy"><span>Win rate</span><strong>{data.winRate}%</strong></div></article>
            <article className="card kpi"><div className="kpi-copy"><span>Avg. deal size</span><strong>{compactMoney(data.avgDeal, user.currency)}</strong></div></article>
            <article className="card kpi"><div className="kpi-copy"><span>Sales cycle</span><strong>{data.cycleDays} days</strong></div></article>
          </section>
          <section className="grid two">
            <article className="card">
              <div className="card-head"><h2>Revenue trend</h2></div>
              <Bars rows={data.revenue} />
            </article>
            <article className="card">
              <div className="card-head"><h2>Deals by source</h2></div>
              {sources.length ? <Donut slices={sources} center={String(sources.reduce((sum, row) => sum + row.count, 0))} caption="Deals" /> : <p className="muted">No opportunities yet.</p>}
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
