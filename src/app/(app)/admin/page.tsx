import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader } from "@/components/ui";
import { updatePicklist, updateWorkspace } from "@/lib/actions/workspace";
import { logoutAll } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/db";
import { settingList } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") redirect("/dashboard?notice=You do not have access to that area");
  const tenant = one<{ name: string; legalName: string | null; industry: string | null; website: string | null; country: string; timezone: string; currency: string; profile: string; mfaRequired: number; approvalDiscountPct: number }>(
    `select name, legal_name, industry, website, country, timezone, currency, profile, mfa_required, approval_discount_pct from tenants where id = ?`,
    user.tenantId,
  );
  const sp = await searchParams;
  const lists = ["lead_sources", "industries", "lost_reasons", "service_lines", "account_types"];
  return (
    <div className="stack">
      <PageHeader eyebrow={user.slug} title="Tenant settings" action={<form action={logoutAll}><button className="btn-ghost">Sign out everywhere</button></form>} />
      <Notice text={q(sp.notice)} />
      <EntityForm
        action={updateWorkspace}
        submitLabel="Save settings"
        fields={[
          { name: "name", label: "Organization", defaultValue: tenant?.name ?? "", required: true },
          { name: "legalName", label: "Legal name", defaultValue: tenant?.legalName ?? "" },
          { name: "industry", label: "Industry", defaultValue: tenant?.industry ?? "" },
          { name: "website", label: "Website", defaultValue: tenant?.website ?? "" },
          { name: "country", label: "Country", defaultValue: tenant?.country ?? "" },
          { name: "timezone", label: "Timezone", defaultValue: tenant?.timezone ?? "", required: true },
          { name: "currency", label: "Base currency", defaultValue: tenant?.currency ?? "", required: true },
          { name: "profile", label: "Profile", type: "select", defaultValue: tenant?.profile ?? "combined", options: ["b2b", "staffing", "combined"].map((item) => ({ value: item, label: item })) },
          { name: "approvalDiscountPct", label: "Discount approval threshold %", type: "number", defaultValue: String(tenant?.approvalDiscountPct ?? 10) },
          { name: "mfaRequired", label: "Require a second step at sign-in", type: "checkbox", defaultValue: tenant?.mfaRequired ? "yes" : "" },
        ]}
      />
      {lists.map((key) => (
        <EntityForm
          key={key}
          action={updatePicklist}
          submitLabel={`Save ${key.replaceAll("_", " ")}`}
          hidden={{ key }}
          fields={[{ name: "value", label: key.replaceAll("_", " "), defaultValue: settingList(user.tenantId, key, []).join(", "), wide: true }]}
        />
      ))}
    </div>
  );
}
