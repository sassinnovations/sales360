import Link from "next/link";
import { EntityForm } from "@/components/entity-form";
import { requestReset } from "@/lib/actions/auth";

export const instant = false;

export default function ForgotPage() {
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>Reset access</h1>
        <p className="muted">If the email belongs to a workspace, a code is issued. This local demo shows it here instead of sending mail.</p>
        <EntityForm action={requestReset} submitLabel="Create reset code" fields={[{ name: "email", label: "Work email", type: "email", required: true }]} />
        <Link href="/reset">I have a code</Link>
      </div>
    </main>
  );
}
