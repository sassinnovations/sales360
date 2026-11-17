import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { PageHeader } from "@/components/ui";
import { acceptParsed, saveCandidate } from "@/lib/actions/staffing";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { getCandidate } from "@/lib/queries";

export const instant = false;

export default async function CandidateDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "candidates")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getCandidate(user, id);
  if (!data) notFound();
  const candidate = data.candidate;
  const parsed = candidate.parsedJson ? (JSON.parse(String(candidate.parsedJson)) as { skills?: string[]; note?: string }) : null;
  return (
    <div className="stack">
      <PageHeader eyebrow="Candidate" title={String(candidate.name)} />
      <article className="card stack">
        <p>{String(candidate.skills ?? "")} · {String(candidate.location ?? "")} · {String(candidate.experienceYears ?? "")} years</p>
        <p>{String(candidate.email ?? "")} · {String(candidate.phone ?? "")}</p>
        <p>{String(candidate.summary ?? "")}</p>
        <p>Consent: {String(candidate.consent)}. Work authorization: {String(candidate.workAuth ?? "Not recorded")}.</p>
        {candidate.resumeName ? <p><a href={`/api/resumes/${id}`}>Download {String(candidate.resumeName)}</a></p> : <p className="muted">No resume on file.</p>}
        {candidate.parseStatus === "suggested" && parsed ? (
          <form action={acceptParsed} className="stack">
            <input type="hidden" name="id" value={id} />
            <p>Suggested, not saved: {(parsed.skills ?? []).join(", ") || "none"}. {parsed.note}</p>
            {canWrite(user.role, "candidates") ? <button className="btn-primary">Accept suggestions</button> : null}
          </form>
        ) : null}
      </article>
      <article className="card stack">
        <h2>Submissions</h2>
        {data.submissions.map((row) => {
          const sub = row as { id: string; requirementTitle: string; accountName: string; status: string };
          return <p key={sub.id}><Link href={`/submissions/${sub.id}`}>{sub.requirementTitle}</Link> at {sub.accountName} · {sub.status}</p>;
        })}
      </article>
      {canWrite(user.role, "candidates") ? (
        <EntityForm
          action={saveCandidate}
          submitLabel="Upload resume"
          hidden={{
            id,
            version: String(candidate.version),
            name: String(candidate.name),
            email: String(candidate.email ?? ""),
            phone: String(candidate.phone ?? ""),
            skills: String(candidate.skills ?? ""),
            experienceYears: String(candidate.experienceYears ?? ""),
            location: String(candidate.location ?? ""),
            availability: String(candidate.availability ?? ""),
            consent: String(candidate.consent ?? "unknown"),
            summary: String(candidate.summary ?? ""),
          }}
          fields={[{ name: "resume", label: "Resume", type: "file", hint: ".pdf,.txt,.doc,.docx" }]}
        />
      ) : null}
      <p className="muted">Upload keeps the file inside this workspace. Text files can suggest skills. PDF text is not extracted here, so those stay for review.</p>
    </div>
  );
}
