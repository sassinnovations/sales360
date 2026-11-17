import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { listAudit } from "@/lib/queries";

export const instant = false;

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin" && user.role !== "auditor") {
    redirect("/dashboard?notice=You do not have access to that area");
  }
  const rows = listAudit(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Read only" title="Audit log" />
      <div className="table-wrap">
        <table>
          <thead><tr>{["When", "Who", "Action", "What happened"].map((item) => <th key={item}>{item}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => {
              const item = row as { id: string; createdAt: string; actorName: string | null; action: string; summary: string };
              return (
                <tr key={item.id}>
                  <td>{formatWhen(item.createdAt, user.timezone)}</td>
                  <td>{item.actorName ?? "System"}</td>
                  <td>{item.action}</td>
                  <td>{item.summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
