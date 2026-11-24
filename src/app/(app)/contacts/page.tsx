import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader, Pill } from "@/components/ui";
import { saveContact } from "@/lib/actions/crm";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { accountsFor, listContacts } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "contacts")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listContacts(user, { q: q(sp.q) });
  return (
    <div className="stack">
      <PageHeader eyebrow="Sales CRM" title="Contacts" action={canWrite(user.role, "contacts") ? <Link className="btn-primary" href="/contacts?new=1">New contact</Link> : null} />
      <Notice text={q(sp.notice)} />
      <form className="card" action="/contacts"><input name="q" placeholder="Search people" defaultValue={q(sp.q)} aria-label="Search contacts" /> <button className="btn-ghost">Search</button></form>
      {q(sp.new) === "1" && canWrite(user.role, "contacts") ? (
        <EntityForm
          action={saveContact}
          submitLabel="Create contact"
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "accountId", label: "Account", type: "select", required: true, options: accountsFor(user).map((account) => ({ value: account.id, label: account.name })) },
            { name: "title", label: "Title" },
            { name: "department", label: "Department" },
            { name: "email", label: "Email", type: "email" },
            { name: "phone", label: "Phone" },
            { name: "country", label: "Country" },
            { name: "state", label: "State" },
            { name: "city", label: "City" },
            { name: "buyingRole", label: "Role in the buy" },
            { name: "consent", label: "Consent", type: "select", defaultValue: "unknown", options: [ {value:"unknown", label:"Unknown"}, {value: "opted_in", label: "Yes"}, {value: "opted_out", label: "No"}, {value: "dnc", label:"DNC(Do Not Contact)"},],},
            { name: "isPrimary", label: "Primary contact for this account", type: "checkbox" },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Name", "Account", "Title", "Email", "Consent"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const contact = row as Record<string, string | null>;
              return (
                <tr key={String(contact.id)}>
                  <td><Link href={`/contacts/${contact.id}`}>{contact.name}</Link></td>
                  <td>{contact.accountName}</td>
                  <td>{contact.title}</td>
                  <td>{contact.email}</td>
                  <td><Pill value={String(contact.consent)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
