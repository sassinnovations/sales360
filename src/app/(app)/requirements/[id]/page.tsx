import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Pill } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { canAccess, canSeeCandidateRates } from "@/lib/permissions";
import { getRequirement } from "@/lib/queries";

export const instant = false;

export default async function RequirementDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "requirements")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getRequirement(user, id);
  if (!data) notFound();
  const item = data.requirement;
  return (
    <div className="stack">
      <PageHeader eyebrow={String(item.accountName)} title={String(item.title)} />
      <article className="card stack">
        <p><Pill value={String(item.status)} /> · {String(item.positions)} position(s) · {String(item.workMode ?? "")} · {String(item.location ?? "")}</p>
        <p>{String(item.skills ?? "")} · {String(item.experience ?? "")}</p>
        {canSeeCandidateRates(user.role) ? <p>Rate {money(Number(item.rateMin), user.currency)} – {money(Number(item.rateMax), user.currency)}</p> : <p>Commercial rates are hidden for your role.</p>}
        <p>{String(item.description ?? "")}</p>
        <p>Must have: {String(item.mustHave ?? "—")}</p>
      </article>
      <article className="card stack">
        <h2>Submissions</h2>
        {data.submissions.length === 0 ? <p className="muted">No candidates submitted yet.</p> : null}
        {data.submissions.map((row) => {
          const sub = row as { id: string; candidateName: string; status: string; proposedRate?: number };
          return (
            <p key={sub.id}>
              <Link href={`/submissions/${sub.id}`}>{sub.candidateName}</Link> · {sub.status}
              {canSeeCandidateRates(user.role) && sub.proposedRate != null ? ` · ${money(sub.proposedRate, user.currency)}` : ""}
            </p>
          );
        })}
        {canAccess(user.role, "submissions") ? <Link href={`/submissions?new=1&requirement=${id}`}>Submit a candidate</Link> : null}
      </article>
    </div>
  );
}
