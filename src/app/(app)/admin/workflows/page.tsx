import { redirect } from "next/navigation";
import { EntityForm } from "@/components/entity-form";
import { Notice, PageHeader } from "@/components/ui";
import { saveRule, setRuleActive } from "@/lib/actions/workspace";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { listRules, listRuns, stagesFor } from "@/lib/queries";
import { q } from "@/lib/search";

export const instant = false;

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user.role !== "owner" && user.role !== "admin") redirect("/dashboard?notice=You do not have access to that area");
  const rules = listRules(user.tenantId);
  const runs = listRuns(user.tenantId);
  const sp = await searchParams;
  return (
    <div className="stack">
      <PageHeader eyebrow="Automation" title="Workflow rules" />
      <Notice text={q(sp.notice)} />
      <p className="muted">New rules stay off until you activate them. A rule runs once per opportunity.</p>
      <EntityForm
        action={saveRule}
        submitLabel="Save inactive rule"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "toStage", label: "When stage becomes", type: "select", options: stagesFor(user.tenantId).map((stage) => ({ value: stage.name, label: stage.name })) },
          { name: "subject", label: "Task to create", required: true },
        ]}
      />
      {rules.map((row) => {
        const rule = row as { id: string; name: string; active: number; conditionJson: string };
        return (
          <article key={rule.id} className="card">
            <h2>{rule.name}</h2>
            <p>{rule.active ? "Active" : "Inactive"} · {rule.conditionJson}</p>
            <form action={setRuleActive}>
              <input type="hidden" name="id" value={rule.id} />
              <input type="hidden" name="active" value={rule.active ? "0" : "1"} />
              <button className="btn-ghost">{rule.active ? "Pause" : "Activate"}</button>
            </form>
          </article>
        );
      })}
      <article className="card stack">
        <h2>Recent runs</h2>
        {runs.map((row) => {
          const run = row as { id: string; ruleName: string; status: string; detail: string; createdAt: string };
          return <p key={run.id}>{run.ruleName} · {run.status} · {run.detail} · {formatWhen(run.createdAt, user.timezone)}</p>;
        })}
      </article>
    </div>
  );
}
