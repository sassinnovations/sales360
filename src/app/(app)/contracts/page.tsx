import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader } from "@/components/ui";
import { saveContract } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listContracts } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "contracts")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listContracts(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Commercial" title="Contracts" />
      <Notice text={q(sp.notice)} />
      <p className="muted">The register tracks dates and value. It is not an e-signature system.</p>
      {canWrite(user.role, "contracts") ? (
        <EntityForm
          action={saveContract}
          submitLabel="Register contract"
          fields={[
            { name: "name", label: "Contract", required: true },
            { name: "accountId", label: "Account", type: "select", required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "startDate", label: "Effective", type: "date", required: true },
            { name: "endDate", label: "End", type: "date", required: true },
            { name: "value", label: "Value", type: "number" },
            { name: "renewalLeadDays", label: "Remind this many days before end", type: "number", defaultValue: "30" },
            { name: "notes", label: "Notes", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Contract", "Account", "Ends", "Value", "Owner"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string | number>;
              return (
                <tr key={String(item.id)}>
                  <td>{item.name}</td>
                  <td>{item.accountName}</td>
                  <td>{formatDate(String(item.endDate), user.timezone)}</td>
                  <td>{money(Number(item.value), String(item.currency))}</td>
                  <td>{item.ownerName}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
