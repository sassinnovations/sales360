import { EntityForm } from "@/components/entity-form";
import { acceptInvite } from "@/lib/actions/auth";

export const instant = false;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>Join the workspace</h1>
        <EntityForm
          action={acceptInvite}
          submitLabel="Activate account"
          hidden={{ token }}
          fields={[
            { name: "name", label: "Your name", required: true },
            { name: "password", label: "Password", type: "password", required: true },
            { name: "terms", label: "I accept the workspace terms", type: "checkbox", required: true },
          ]}
        />
      </div>
    </main>
  );
}
