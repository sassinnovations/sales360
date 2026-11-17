import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Pill } from "@/components/ui";
import { saveCase } from "@/lib/actions/commercial";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/permissions";
import { getCase } from "@/lib/queries";

export const instant = false;

export default async function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "cases")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = getCase(user, id);
  if (!data) notFound();
  const item = data.supportCase;
  const risk = String(item.slaDueAt ?? "") < new Date().toISOString() && item.status !== "Closed";
  return (
    <div className="stack">
      <PageHeader eyebrow="Support case" title={String(item.subject)} />
      <article className="card stack">
        <p><Link href={`/accounts/${item.accountId}`}>{String(item.accountName)}</Link> · <Pill value={String(item.priority)} /> · {String(item.status)}</p>
        <p>SLA {formatWhen(String(item.slaDueAt ?? ""), user.timezone)}{risk ? " · breach risk" : ""}</p>
        <p>{String(item.description ?? "")}</p>
        {item.resolution ? <p>Resolution: {String(item.resolution)}</p> : null}
      </article>
      <article className="card stack">
        <h2>Notes</h2>
        {data.notes.map((row) => {
          const note = row as { id: string; body: string; visibility: string; authorName: string | null; createdAt: string };
          return <p key={note.id}><strong>{note.visibility}</strong> · {note.authorName} · {note.body}</p>;
        })}
      </article>
      {canWrite(user.role, "cases") ? (
        <EntityForm
          action={saveCase}
          submitLabel="Update case"
          hidden={{ id, version: String(item.version), accountId: String(item.accountId), subject: String(item.subject), description: String(item.description ?? ""), priority: String(item.priority) }}
          fields={[
            { name: "status", label: "Status", type: "select", defaultValue: String(item.status), options: ["New", "Assigned", "In Progress", "Waiting on Customer", "Resolved", "Closed"].map((value) => ({ value, label: value })) },
            { name: "resolution", label: "Resolution", wide: true },
            { name: "note", label: "Add a note", type: "textarea", wide: true },
            { name: "visibility", label: "Note visibility", type: "select", defaultValue: "internal", options: [{ value: "internal", label: "Internal" }, { value: "customer", label: "Customer-visible" }] },
          ]}
        />
      ) : null}
    </div>
  );
}
