import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { canAccess, canExport } from "@/lib/permissions";
import { reports } from "@/lib/queries";

export const instant = false;

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "reports")) redirect("/dashboard?notice=You do not have access to that area");
  const data = reports(user);
  const metrics = [
    ["Lead conversion", `${data.leadConversion}%`],
    ["Win rate", `${data.winRate}%`],
    ["Weighted pipeline", money(data.weighted, user.currency)],
    ["Sales cycle", `${data.cycleDays} days`],
    ["Activity completion", `${data.activityCompletion}%`],
    ["Submission → interview", `${data.submissionToInterview}%`],
    ["Interview → placement", `${data.interviewToPlacement}%`],
    ["Placements", String(data.placements)],
  ];
  const max = Math.max(...data.funnel.map((row) => Number(row.count)), 1);
  return (
    <div className="stack">
      <PageHeader
        eyebrow={`${user.currency} · ${user.timezone}`}
        title="Analytics"
        action={canExport(user.role) ? <a className="btn-primary" href="/api/reports/pipeline">Export pipeline</a> : <span className="muted">Export is off for this role</span>}
      />
      <section className="grid kpis">
        {metrics.map(([label, value]) => (
          <article key={label} className="card kpi"><span>{label}</span><strong>{value}</strong></article>
        ))}
      </section>
      <article className="card stack">
        <h2>Lead funnel</h2>
        {data.funnel.map((row) => (
          <div key={row.status}>
            <Link href={`/leads?status=${row.status}`}>{row.status}</Link> · {row.count}
            <div className="bar"><span style={{ width: `${(Number(row.count) / max) * 100}%` }} /></div>
          </div>
        ))}
      </article>
      <article className="card">
        <h2>How the numbers are calculated</h2>
        {data.definitions.map(([name, text]) => <p key={name}><strong>{name}.</strong> {text}</p>)}
      </article>
    </div>
  );
}
