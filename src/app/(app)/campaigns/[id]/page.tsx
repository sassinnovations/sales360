import { notFound, redirect } from "next/navigation";
import { PageHeader, Pill } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { campaignDetail } from "@/lib/queries";

export const instant = false;

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "campaigns")) redirect("/dashboard?notice=You do not have access to that area");
  const { id } = await params;
  const data = campaignDetail(user, id);
  if (!data) notFound();
  const ready = data.members.filter((row) => (row as { status: string }).status === "Ready").length;
  return (
    <div className="stack">
      <PageHeader eyebrow="Campaign" title={String(data.campaign.name)} />
      <article className="card stack">
        <p>{String(data.campaign.objective ?? "")}</p>
        <p>Attribution model: {String(data.campaign.attribution)}. First touch is the label for this workspace.</p>
        <p>{ready} send-ready · {data.members.length - ready} suppressed</p>
        {data.members.map((row) => {
          const member = row as { name: string; email: string; consent: string; status: string };
          return <p key={member.email}>{member.name} · {member.email} · consent {member.consent} · <Pill value={member.status} /></p>;
        })}
      </article>
    </div>
  );
}
