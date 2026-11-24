import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { completeActivity, saveActivity } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { listActivities, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function ActivitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "activities") && !canAccess(user.role, "tasks")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const view = q(sp.view) || "open";
  const rows = listActivities(user, { view, q: q(sp.q) });
  return (
    <div className="stack">
      <PageHeader
        title="Activities"
        action={
          canWrite(user.role, "activities") || canWrite(user.role, "tasks") ? (
            <Link className="btn-primary" href={`/activities?view=${view}&new=1`}>+ Add activity</Link>
          ) : null
        }
      />
      <Notice text={q(sp.notice)} />
      <nav className="tabs">
        {[["open", "Open"], ["today", "Due soon"], ["overdue", "Overdue"], ["completed", "Completed"]].map(([id, label]) => (
          <Link key={id} className={view === id ? "on" : ""} href={`/activities?view=${id}`}>{label}</Link>
        ))}
      </nav>
      {q(sp.new) === "1" && (canWrite(user.role, "activities") || canWrite(user.role, "tasks")) ? (
        <EntityForm
          action={saveActivity}
          submitLabel="Add activity"
          fields={[
            { name: "type", label: "Type", type: "select", defaultValue: "task", options: ["call", "email", "meeting"].map((item) => ({ value: item, label: item })) },
            { name: "subject", label: "Subject", required: true },
            { name: "dueAt", label: "Due", type: "datetime-local", required: true },
            { name: "priority", label: "Priority", type: "select", defaultValue: "Normal", options: ["Low", "Normal", "High"].map((item) => ({ value: item, label: item })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "relatedType", label: "Related to", type: "select", options: ["lead", "account", "contact", "opportunity", "requirement", "candidate"].map((item) => ({ value: item, label: item })) },
            { name: "relatedId", label: "Record id" },
            { name: "body", label: "Notes", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["When", "Type", "Subject", "Priority", "Status", "Owner", ""].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7}>Nothing in this view.</td></tr> : rows.map((row) => {
              const item = row as Record<string, string | null>;
              const overdue = item.status === "open" && item.dueAt && item.dueAt < new Date().toISOString();
              return (
                <tr key={String(item.id)}>
                  <td>{formatWhen(item.dueAt, user.timezone)}</td>
                  <td>{item.type}</td>
                  <td>{item.subject}</td>
                  <td>{item.priority}</td>
                  <td><Pill value={overdue ? "Overdue" : String(item.status)} /></td>
                  <td>{item.ownerName}</td>
                  <td>
                    {item.status === "open" && (canWrite(user.role, "tasks") || canWrite(user.role, "activities")) ? (
                      <form action={completeActivity}>
                        <input type="hidden" name="id" value={String(item.id)} />
                        <button className="btn-ghost">Complete</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
