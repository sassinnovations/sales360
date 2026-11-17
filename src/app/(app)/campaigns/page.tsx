import Link from "next/link";
import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader } from "@/components/ui";
import { saveCampaign } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { listCampaigns, listContacts } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "campaigns")) redirect("/dashboard?notice=You do not have access to that area");
  const sp = await searchParams;
  const rows = listCampaigns(user);
  const contacts = listContacts(user, {});
  return (
    <div className="stack">
      <PageHeader eyebrow="Business development" title="Campaigns" />
      <Notice text={q(sp.notice)} />
      {canWrite(user.role, "campaigns") ? (
        <EntityForm
          action={saveCampaign}
          submitLabel="Create campaign"
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "objective", label: "Objective", wide: true },
            { name: "type", label: "Type", defaultValue: "Email" },
            { name: "startDate", label: "Start", type: "date" },
            { name: "endDate", label: "End", type: "date" },
            { name: "budget", label: "Budget", type: "number" },
            { name: "contactId", label: "Include contact", type: "select", options: contacts.map((row) => ({ value: String((row as { id: string }).id), label: `${(row as { name: string }).name} (${(row as { consent: string }).consent})` })) },
          ]}
        />
      ) : null}
      <div className="table-wrap">
        <table>
          <thead><tr>{["Campaign", "Status", "Owner", "Attribution"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string>;
              return (
                <tr key={item.id}>
                  <td><Link href={`/campaigns/${item.id}`}>{item.name}</Link></td>
                  <td>{item.status}</td>
                  <td>{item.ownerName}</td>
                  <td>{item.attribution}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
