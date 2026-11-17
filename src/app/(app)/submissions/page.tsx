import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveSubmission } from "@/lib/actions/staffing";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { listCandidates, listRequirements, listSubmissions } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "submissions")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listSubmissions(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Staffing" title="Submissions" />
      <Notice text={q(sp.notice)} />
      {canWrite(user.role, "submissions") ? (
        <EntityForm
          action={saveSubmission}
          submitLabel="Create submission"
          hidden={q(sp.requirement) ? { requirementId: q(sp.requirement) } : undefined}
          fields={[
            { name: "candidateId", label: "Candidate", type: "select", required: true, options: listCandidates(user, {}).map((row) => ({ value: String((row as { id: string }).id), label: String((row as { name: string }).name) })) },
            ...(q(sp.requirement) ? [] : [{ name: "requirementId", label: "Requirement", type: "select" as const, required: true, options: listRequirements(user, {}).map((row) => ({ value: String((row as { id: string }).id), label: String((row as { title: string }).title) })) }]),
            { name: "status", label: "Status", type: "select", defaultValue: "Submitted", options: ["Draft", "Submitted", "Client Review", "Shortlisted", "Interview", "Rejected", "Withdrawn", "Selected"].map((item) => ({ value: item, label: item })) },
            { name: "proposedRate", label: "Proposed rate", type: "number" },
            { name: "notes", label: "Notes", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Candidate", "Requirement", "Client", "Status", "Recruiter"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string>;
              return (
                <tr key={item.id}>
                  <td><Link href={`/submissions/${item.id}`}>{item.candidateName}</Link></td>
                  <td>{item.requirementTitle}</td>
                  <td>{item.accountName}</td>
                  <td><Pill value={item.status} /></td>
                  <td>{item.recruiterName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
