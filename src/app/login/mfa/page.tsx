import { EntityForm } from "@/components/entity-form";
import { mfaEnrollment, verifyMfa } from "@/lib/actions/auth";

export const instant = false;

export default async function MfaPage() {
  const state = await mfaEnrollment();
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>{state?.mfaCode ? "Enter your code" : "Set a 6-digit code"}</h1>
        <p className="muted">
          {state?.mfaCode
            ? "This workspace is asking for the code you enrolled."
            : "Policy requires a second step. Choose a 6-digit code and enter it to finish signing in. Keep it — this demo does not use an authenticator app."}
        </p>
        <EntityForm action={verifyMfa} submitLabel="Continue" fields={[{ name: "code", label: "6-digit code", required: true }]} />
      </div>
    </main>
  );
}
