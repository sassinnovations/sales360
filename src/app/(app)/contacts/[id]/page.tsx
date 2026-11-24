import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Pill } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { getContact } from "@/lib/queries";

export const instant = false;

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "contacts")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const contact = getContact(user, id);
  if (!contact) notFound();
  return (
    <div className="stack">
      <PageHeader eyebrow="Contact" title={String(contact.name)} />
      <article className="card stack">
        <p>{String(contact.title ?? "")} · <Link href={`/accounts/${contact.accountId}`}>{String(contact.accountName ?? "Account")}</Link></p>
        <p>{String(contact.email ?? "No email")} · {String(contact.phone ?? "No phone")}</p>
        <p>Location: {String(contact.city ?? "—")}, {String(contact.state ?? "—")}, {String(contact.country ?? "—")}</p>
        <p>Buying role: {String(contact.buyingRole ?? "Not set")} · Preferred channel: {String(contact.channel ?? "Email")}</p>
        <p>Consent <Pill value={String(contact.consent)} />. Check this before a campaign or email.</p>
        {contact.isPrimary ? <p>Primary contact for this account.</p> : null}
      </article>
    </div>
  );
}
