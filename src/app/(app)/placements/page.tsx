import { redirect } from "next/navigation";
import { PageHeader, Pill } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canAccess, canSeeMargin } from "@/lib/permissions";
import { listPlacements } from "@/lib/queries";

export const instant = false;

export default async function PlacementsPage() {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "placements")) redirect("/dashboard?notice=You do not have access to that area");
  const rows = listPlacements(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Delivery" title="Placements" />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Person", "Role", "Account", "Start", "Status", ...(canSeeMargin(user.role) ? ["Margin"] : [])].map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const item = row as Record<string, string | number | null>;
              return (
                <tr key={String(item.id)}>
                  <td>{item.candidateName}</td>
                  <td>{item.role}</td>
                  <td>{item.accountName}</td>
                  <td>{formatDate(String(item.startDate ?? ""), user.timezone)}</td>
                  <td><Pill value={String(item.status)} /></td>
                  {canSeeMargin(user.role) ? <td>{item.marginPct != null ? `${item.marginPct}%` : "—"}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Bill and pay rates stay off this list unless your role can see margin. Create a placement from a selected submission.</p>
    </div>
  );
}
