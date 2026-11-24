import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveProposal } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listOpportunities, listProposals } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "proposals")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listProposals(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Commercial" title="Proposals" />
      <Notice text={q(sp.notice)} />
      <p className="muted">Discounts above {user.approvalDiscountPct}% stay in review until someone who can approve them releases the send.</p>
      {canWrite(user.role, "proposals") ? (
        <EntityForm
          action={saveProposal}
          submitLabel="Save proposal"
          hidden={{
            ...(q(sp.opportunity) ? { opportunityId: q(sp.opportunity) } : {}),
            ...(q(sp.account) ? { accountId: q(sp.account) } : {}),
          }}
          fields={[
            { name: "name", label: "Name", required: true },
            ...(q(sp.account) ? [] : [{ name: "accountId", label: "Account", type: "select" as const, required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) }]),
            ...(q(sp.opportunity) ? [] : [{ name: "opportunityId", label: "Opportunity", type: "select" as const, options: listOpportunities(user, { status: "all" }).map((row) => ({ value: String((row as { id: string }).id), label: String((row as { name: string }).name) })) }]),
            { name: "validUntil", label: "Valid until", type: "date", required: true },
            { name: "discountPct", label: "Discount %", type: "number", defaultValue: "0" },
            { name: "taxPct", label: "Tax %", type: "number", defaultValue: "18" },
            { name: "description", label: "Service line description", required: true },
            { name: "quantity", label: "Quantity", type: "number", defaultValue: "1" },
            { name: "rate", label: "Rate", type: "number", defaultValue: "0" },
            { name: "notes", label: "Assumptions", type: "textarea", wide: true },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Proposal", "Account", "Status", "Discount", "Version"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string | number>;
              return (
                <tr key={String(item.id)}>
                  <td><Link href={`/proposals/${item.id}`}>{item.name}</Link></td>
                  <td>{item.accountName}</td>
                  <td><Pill value={String(item.status)} /></td>
                  <td>{item.discountPct}%</td>
                  <td>v{item.versionNo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
