import { redirect } from "next/navigation";
import { AssistantChat } from "@/components/assistant-chat";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export const instant = false;

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!canAccess(user.role, "assistant")) redirect("/dashboard?notice=You do not have access to that area");
  return (
    <div className="stack">
      <PageHeader eyebrow="Workspace" title="AI assistant" />
      <p className="muted">Answers come from records in {user.tenantName} that your role can open. Facts and drafts are labeled. Sending still takes a separate confirmation, and this build does not connect a mailbox.</p>
      <AssistantChat />
    </div>
  );
}
