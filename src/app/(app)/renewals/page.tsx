import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, money } from "@/lib/format";
import { canAccess } from "@/lib/permissions";
import { upcomingRenewals } from "@/lib/queries";
import { updateRenewalStatus } from "@/lib/actions/commercial";

export const instant = false;

export default async function RenewalsPage() {
  const user = await getCurrentUser();
  await connection();
  if (!canAccess(user.role, "renewals")) {
    redirect("/dashboard?notice=You do not have access to that area");
  }

  const rows = upcomingRenewals(user);
  const soon = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="stack">
      <PageHeader eyebrow="Account growth" title="Renewals" />
      <p className="muted">
        Health on the account is advisory. Each date below links back to the
        contract record's account.
      </p>

      {rows.map((row) => {
        const item = row as {
          id: string;
          name: string;
          accountId: string;
          accountName: string;
          endDate: string;
          value: number;
          currency: string;
          renewalLeadDays: number;
          renewalStatus: string;
        };

        const due = item.endDate <= soon;

        return (
          <article key={item.id} className="card">
            <h2>{item.name}</h2>

            <p>
              <Link href={`/accounts/${item.accountId}`}>
                {item.accountName}
              </Link>{" "}
              · ends {formatDate(item.endDate, user.timezone)} ·{" "}
              {money(item.value, item.currency)}
            </p>

            <p>
              {due
                ? `Inside the ${item.renewalLeadDays}-day reminder window.`
                : `Reminder is set for ${item.renewalLeadDays} days before the end.`}
            </p>

            <form action={updateRenewalStatus} className="stack">
              <input type="hidden" name="contractId" value={item.id} />

              <label>
                Renewal status
                <select
                  name="renewalStatus"
                  defaultValue={item.renewalStatus || "Not Started"}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Discussion">In Discussion</option>
                  <option value="Renewed">Renewed</option>
                  <option value="Not Renewing">Not Renewing</option>
                </select>
              </label>

              <button type="submit">Update status</button>
            </form>
          </article>
        );
      })}
    </div>
  );
}
