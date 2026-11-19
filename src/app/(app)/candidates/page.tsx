import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { StaffingTabs } from "@/components/section-nav";
import { Notice, PageHeader } from "@/components/ui";
import { saveCandidate } from "@/lib/actions/staffing";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { canAccess, canSeeCandidateRates, canWrite } from "@/lib/permissions";
import { listCandidates } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "candidates")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listCandidates(user, { q: q(sp.q), status: q(sp.status) });
  const rates = canSeeCandidateRates(user.role);
  return (
    <div className="stack">
      <PageHeader title="IT Staffing" action={canWrite(user.role, "candidates") ? <Link className="btn-primary" href="/candidates?new=1">+ Add candidate</Link> : null} />
      <StaffingTabs current="/candidates" />
      <Notice text={q(sp.notice)} />
      <form className="card" action="/candidates">
        <input name="q" placeholder="Skills, name, or location" defaultValue={q(sp.q)} aria-label="Search candidates" />
        <button className="btn-ghost">Search</button>
      </form>
      {q(sp.new) === "1" ? (
        <EntityForm
          action={saveCandidate}
          submitLabel="Create candidate"
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone" },
            { name: "skills", label: "Skills" },
            { name: "experienceYears", label: "Years", type: "number" },
            { name: "location", label: "Location" },
            { name: "availability", label: "Availability" },
            ...(rates ? [{ name: "rateExpectation", label: "Rate expectation", type: "number" }] : []),
            { name: "workAuth", label: "Work authorization" },
            { name: "consent", label: "Consent", type: "select", defaultValue: "unknown", options: ["unknown", "granted", "declined"].map((item) => ({ value: item, label: item })) },
            { name: "summary", label: "Summary", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Name", "Skills", "Location", "Experience", "Status", ...(rates ? ["Rate"] : [])].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const candidate = row as Record<string, string | number | null>;
              return (
                <tr key={String(candidate.id)}>
                  <td><Link href={`/candidates/${candidate.id}`}>{candidate.name}</Link></td>
                  <td>{candidate.skills}</td>
                  <td>{candidate.location}</td>
                  <td>{candidate.experienceYears}</td>
                  <td>{candidate.status}</td>
                  {rates ? <td>{candidate.rateExpectation != null ? money(Number(candidate.rateExpectation), user.currency) : "—"}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
