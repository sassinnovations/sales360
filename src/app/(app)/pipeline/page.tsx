import Link from "next/link";
import { BoardToggle } from "@/components/section-nav";
import { Notice, PageHeader } from "@/components/ui";
import { PipelineBoard } from "@/components/pipeline-board";
import { getCurrentUser } from "@/lib/auth";
import { canAccess, canWrite } from "@/lib/permissions";
import { pipelineBoard } from "@/lib/queries";
import { q } from "@/lib/search";
import { redirect } from "next/navigation";

export const instant = false;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "pipeline")) redirect("/dashboard?notice=You do not have access to that area");
  const columns = pipelineBoard(user);
  const sp = await searchParams;
  return (
    <div className="stack">
      <PageHeader
        title="Opportunities"
        action={
          <div className="page-actions">
            {canWrite(user.role, "opportunities") ? <Link className="btn-primary" href="/opportunities?new=1">+ New opportunity</Link> : null}
            <BoardToggle current="board" />
          </div>
        }
      />
      <Notice text={q(sp.notice)} />
      <p className="muted">Drag a card between open stages. Closed-won and closed-lost stay on the opportunity record.</p>
      <PipelineBoard columns={columns} />
    </div>
  );
}
