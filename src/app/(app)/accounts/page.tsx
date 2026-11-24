import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveAccount } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listAccounts, settingList, usersInTenant } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "accounts")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const data = listAccounts(user, { q: q(sp.q), status: q(sp.status) });
  const types = settingList(user.tenantId, "account_types", []);
  const industries = settingList(user.tenantId, "industries", []);
  const regions = settingList(user.tenantId, "regions", [
  "North",
  "South",
  "East",
  "West",
  "Central",
  "North America",
  "South America",
  "Europe",
  "Middle East",
  "Africa",
  "Asia Pacific",
  "Oceania",
]);
  return (
    <div className="stack">
      <PageHeader eyebrow="Customer 360" title="Accounts" action={canWrite(user.role, "accounts") ? <Link className="btn-primary" href="/accounts?new=1">New account</Link> : null} />
      <Notice text={q(sp.notice)} />
      <form className="card" action="/accounts" style={{ display: "flex", gap: 8 }}>
        <input name="q" placeholder="Search accounts" defaultValue={q(sp.q)} aria-label="Search accounts" />
        <button className="btn-ghost">Search</button>
      </form>
      {q(sp.new) === "1" && canWrite(user.role, "accounts") ? (
        <EntityForm
          action={saveAccount}
          submitLabel="Create account"
          fields={[
                        { name: "name", label: "Account name", required: true },
            { name: "type", label: "Type", type: "select", options: types.map((item) => ({ value: item, label: item })) },
            { name: "industry", label: "Industry", type: "select", options: industries.map((item) => ({ value: item, label: item })) },
            { name: "website", label: "Website" },
            { name: "linkedinUrl", label: "LinkedIn URL" },
            { name: "region", label: "Region", type: "select", options: regions.map((item) => ({ value: item, label: item, })), },
            { name: "country", label: "Country", wide: true },
            { name: "state", label: "State / Province" },
            { name: "city", label: "City" },
            { name: "annualRevenue", label: "Annual Revenue", type: "number" },
            {
              name: "accountStatus",
              label: "Account Status",
              type: "select",
              defaultValue: "New",
              options: ["New", "Prospecting", "Qualification", "Negotiation", "Closed Won", "Closed Lost"].map((item) => ({ value: item, label: item })),
            },
            { name: "ownerId", label: "Owner", type: "select", defaultValue: user.id, options: usersInTenant(user.tenantId).map((person) => ({ value: person.id, label: person.name })) },
            { name: "parentId", label: "Parent account", type: "select", options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Account", "Type", "Industry", "Region", "Owner", "Account Status", "Open pipeline"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {data.rows.length === 0 ? <tr><td colSpan={7}>No accounts match.</td></tr> : data.rows.map((row) => {
              const account = row as Record<string, string | number | null>;
              return (
                <tr key={String(account.id)}>
                  <td><Link href={`/accounts/${account.id}`}>{account.name}</Link></td>
                  <td>{account.type}</td>
                  <td>{account.industry}</td>
                  <td>{account.region}</td>
                  <td>{account.ownerName}</td>
                  <td><Pill value={String(account.account_status ?? "New")} /></td>
                  <td>{money(Number(account.openPipeline ?? 0), user.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
