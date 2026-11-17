import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveInterview, savePlacement } from "@/lib/actions/staffing";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { getSubmission } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function SubmissionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "submissions")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getSubmission(user, id);
  if (!data) notFound();
  const sub = data.submission;
  const sp = await searchParams;
  return (
    <div className="stack">
      <PageHeader eyebrow={String(sub.accountName)} title={`${sub.candidateName} → ${sub.requirementTitle}`} />
      <Notice text={q(sp.notice)} />
      <article className="card stack">
        <p><Pill value={String(sub.status)} /> · Requirement is {String(sub.requirementStatus)}</p>
        <p><Link href={`/candidates/${sub.candidateId}`}>Candidate</Link> · <Link href={`/requirements/${sub.requirementId}`}>Requirement</Link></p>
        <p>{String(sub.notes ?? "")}</p>
      </article>
      <article className="card stack">
        <h2>Interviews</h2>
        {data.interviews.map((row) => {
          const item = row as { id: string; roundName: string; scheduledAt: string; outcome: string; feedback: string | null; participants: string };
          return <p key={item.id}>{item.roundName} · {formatWhen(item.scheduledAt, user.timezone)} · {item.outcome} · {item.participants}<br />{item.feedback}</p>;
        })}
        {data.history.map((row) => {
          const item = row as { summary: string; createdAt: string };
          return <p key={item.createdAt}>{item.summary}</p>;
        })}
      </article>
      {canWrite(user.role, "submissions") ? (
        <EntityForm
          action={saveInterview}
          submitLabel="Save interview"
          hidden={{ submissionId: id }}
          fields={[
            { name: "roundName", label: "Round", defaultValue: "Interview" },
            { name: "scheduledAt", label: "When", type: "datetime-local", required: true },
            { name: "mode", label: "Mode", type: "select", defaultValue: "Video", options: ["Video", "Phone", "On-site"].map((item) => ({ value: item, label: item })) },
            { name: "participants", label: "Participants", required: true },
            { name: "outcome", label: "Outcome", type: "select", defaultValue: "Scheduled", options: ["Scheduled", "Advance", "Hold", "Reject"].map((item) => ({ value: item, label: item })) },
            { name: "feedback", label: "Feedback", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      {canWrite(user.role, "placements") ? (
        <EntityForm
          action={savePlacement}
          submitLabel="Create placement"
          hidden={{ submissionId: id }}
          fields={[
            { name: "role", label: "Role", required: true, defaultValue: String(sub.requirementTitle) },
            { name: "startDate", label: "Start", type: "date", required: true },
            { name: "endDate", label: "End", type: "date" },
            { name: "billRate", label: "Bill rate", type: "number" },
            { name: "payRate", label: "Pay rate", type: "number" },
            { name: "renewalDate", label: "Renewal reminder", type: "date" },
            { name: "override", label: "Manager override if not selected", type: "checkbox" },
            { name: "notes", label: "Notes", type: "textarea", wide: true },
          ]}
        />
      ) : null}
    </div>
  );
}
