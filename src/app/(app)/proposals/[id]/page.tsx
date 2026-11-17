import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { approveProposal, markProposalSent } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { canAccess, canApprove, canWrite } from "@/lib/permissions";
import { getProposal } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function ProposalDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "proposals")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getProposal(user, id);
  if (!data) notFound();
  const proposal = data.proposal;
  const subtotal = data.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate), 0);
  const discounted = subtotal * (1 - Number(proposal.discountPct) / 100);
  const total = discounted * (1 + Number(proposal.taxPct) / 100);
  const sp = await searchParams;
  const blocked = Number(proposal.discountPct) > user.approvalDiscountPct && proposal.status !== "Approved";
  return (
    <div className="stack">
      <PageHeader eyebrow="Proposal" title={String(proposal.name)} />
      <Notice text={q(sp.notice)} />
      <article className="card stack">
        <p><Pill value={String(proposal.status)} /> · {String(proposal.accountName)} · valid {String(proposal.validUntil).slice(0, 10)}</p>
        <p>Discount {String(proposal.discountPct)}% · approval threshold {user.approvalDiscountPct}%</p>
        <table>
          <thead><tr><th>Line</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{money(item.rate, String(proposal.currency))}</td>
                <td>{money(item.quantity * item.rate, String(proposal.currency))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Subtotal {money(subtotal, String(proposal.currency))} · after discount {money(discounted, String(proposal.currency))} · with tax {money(total, String(proposal.currency))}</p>
        <p>{String(proposal.notes ?? "")}</p>
        <p className="muted">Version {String(proposal.versionNo)} stays locked after approval. This screen is the preview; there is no external send from this local workspace.</p>
      </article>
      {canApprove(user.role) && proposal.status === "Internal Review" ? (
        <form action={approveProposal}><input type="hidden" name="id" value={id} /><button className="btn-primary">Approve</button></form>
      ) : null}
      {canWrite(user.role, "proposals") ? (
        <form action={markProposalSent}>
          <input type="hidden" name="id" value={id} />
          <button className="btn-ghost" disabled={Boolean(blocked)}>Mark sent</button>
          {blocked ? <p className="err">Approval is required before this can be marked sent.</p> : null}
        </form>
      ) : null}
    </div>
  );
}
