import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveRequirement } from "@/lib/actions/staffing";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canSeeCandidateRates, canWrite } from "@/lib/permissions";
import { accountsFor, listRequirements, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;
const STATUSES = ["New", "Qualified", "Sourcing", "Submitted", "Interviewing", "On Hold", "Filled", "Cancelled"];

export default async function RequirementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "requirements")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listRequirements(user, { q: q(sp.q), status: q(sp.status) });
  const showRates = canSeeCandidateRates(user.role);
  return (
    <div className="stack">
      <PageHeader eyebrow="Staffing" title="Client requirements" action={canWrite(user.role, "requirements") ? <Link className="btn-primary" href="/requirements?new=1">New requirement</Link> : null} />
      <Notice text={q(sp.notice)} />
      {q(sp.new) === "1" ? (
        <EntityForm
          action={saveRequirement}
          submitLabel="Create requirement"
          fields={[
            { name: "title", label: "Role", required: true },
            { name: "accountId", label: "Client", type: "select", required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "status", label: "Status", type: "select", defaultValue: "New", options: STATUSES.map((item) => ({ value: item, label: item })) },
            { name: "skills", label: "Skills" },
            { name: "experience", label: "Experience" },
            { name: "location", label: "Location" },
            { name: "workMode", label: "Work mode", type: "select", options: ["Remote", "Hybrid", "On-site"].map((item) => ({ value: item, label: item })) },
            { name: "employmentType", label: "Employment", type: "select", options: ["Contract", "Permanent"].map((item) => ({ value: item, label: item })) },
            { name: "positions", label: "Positions", type: "number", defaultValue: "1", required: true },
            { name: "priority", label: "Priority", type: "select", defaultValue: "Normal", options: ["Low", "Normal", "High"].map((item) => ({ value: item, label: item })) },
            ...(showRates ? [{ name: "rateMin", label: "Min rate", type: "number" }, { name: "rateMax", label: "Max rate", type: "number" }] : []),
            { name: "startDate", label: "Start", type: "date" },
            { name: "targetDate", label: "Target", type: "date" },
            { name: "hiringManager", label: "Hiring manager" },
            { name: "mustHave", label: "Must have", wide: true },
            { name: "description", label: "Description", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Role", "Client", "Status", "Positions", "Owner", "Submissions"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string | number>;
              return (
                <tr key={String(item.id)}>
                  <td><Link href={`/requirements/${item.id}`}>{item.title}</Link></td>
                  <td>{item.accountName}</td>
                  <td><Pill value={String(item.status)} /></td>
                  <td>{item.positions}</td>
                  <td>{item.ownerName}</td>
                  <td>{item.submissionCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
