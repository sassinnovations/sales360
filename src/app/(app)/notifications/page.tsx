import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { markAllRead } from "@/lib/actions/workspace";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { listNotifications } from "@/lib/queries";

export const instant = false;

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const rows = listNotifications(user);
  return (
    <div className="stack">
      <PageHeader eyebrow="Workspace" title="Notifications" action={<form action={markAllRead}><button className="btn-ghost">Mark all read</button></form>} />
      {rows.length === 0 ? <p className="muted">You're caught up.</p> : null}
      {rows.map((row) => {
        const item = row as { id: string; title: string; body: string | null; href: string | null; createdAt: string; readAt: string | null };
        return (
          <article key={item.id} className="card">
            <h2>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h2>
            <p>{item.body}</p>
            <p className="muted">{formatWhen(item.createdAt, user.timezone)} {item.readAt ? "· read" : "· new"}</p>
          </article>
        );
      })}
    </div>
  );
}
