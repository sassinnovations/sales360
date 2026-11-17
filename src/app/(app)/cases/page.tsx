import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Pill } from "@/components/ui";
import { saveCase } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listCases, usersInTenant } from "@/lib/queries";

export const instant = false;

export default async function CasesPage() {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "cases")) redirect("/dashboard?notice=You do not have access to that area");
  const rows = listCases(user, {});
  return (
    <div className="stack">
      <PageHeader eyebrow="Support" title="Cases" />
      {canWrite(user.role, "cases") ? (
        <EntityForm
          action={saveCase}
          submitLabel="Log case"
          fields={[
            { name: "subject", label: "Subject", required: true },
            { name: "accountId", label: "Account", type: "select", required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "priority", label: "Priority", type: "select", defaultValue: "Normal", options: ["Low", "Normal", "High"].map((item) => ({ value: item, label: item })) },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "description", label: "Description", type: "textarea", wide: true, required: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Subject", "Account", "Priority", "Status", "SLA"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string>;
              const risk = item.slaDueAt && item.status !== "Closed" && item.slaDueAt < new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
              return (
                <tr key={item.id}>
                  <td><Link href={`/cases/${item.id}`}>{item.subject}</Link></td>
                  <td>{item.accountName}</td>
                  <td><Pill value={item.priority} /></td>
                  <td>{item.status}</td>
                  <td>{formatWhen(item.slaDueAt, user.timezone)}{risk ? " · at risk" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
