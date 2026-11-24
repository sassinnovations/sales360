import { notFound, redirect } from "next/navigation";
import { PageHeader, Pill } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { campaignDetail } from "@/lib/queries";
import { updateCampaignMemberStage } from "@/lib/actions/commercial";

export const instant = false;

export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!canAccess(user.role, "campaigns")) {
    redirect(
      "/dashboard?notice=You do not have access to that area",
    );
  }

  const { id } = await params;
  const data = campaignDetail(user, id);

  if (!data) notFound();

  const ready = data.members.filter(
    (row) => (row as { status: string }).status === "Ready",
  ).length;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Campaign"
        title={String(data.campaign.name)}
      />

      <article className="card stack">
        <p>{String(data.campaign.objective ?? "")}</p>

        <p>
          Attribution model: {String(data.campaign.attribution)}.
          First touch is the label for this workspace.
        </p>

        <p>
          {ready} send-ready · {data.members.length - ready} suppressed
        </p>

        {data.members.map((row) => {
          const member = row as {
            id: string;
            name: string;
            email: string;
            consent: string;
            status: string;
            stage: string;
          };

          return (
            <form
              key={member.id}
              action={updateCampaignMemberStage}
            >
              <input
                type="hidden"
                name="memberId"
                value={member.id}
              />

              <span>
                {member.name} · {member.email} · consent {member.consent}
              </span>

              <select
                name="stage"
                defaultValue={member.stage}
                aria-label={`Stage for ${member.name}`}
              >
                <option value="New">New</option>
                <option value="Suppressed">Suppressed</option>
              </select>

              <Pill value={member.status} />

              <button
                className="btn-ghost"
                type="submit"
              >
                Save
              </button>
            </form>
          );
        })}
      </article>
    </div>
  );
}
