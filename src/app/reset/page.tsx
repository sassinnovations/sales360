import { EntityForm } from "@/components/entity-form";
import { resetPassword } from "@/lib/actions/auth";

export const instant = false;

export default function ResetPage() {
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>Choose a new password</h1>
        <EntityForm
          action={resetPassword}
          submitLabel="Update password"
          fields={[
            { name: "email", label: "Email", type: "email", required: true },
            { name: "code", label: "Reset code", required: true },
            { name: "password", label: "New password", type: "password", required: true },
            { name: "confirm", label: "Confirm password", type: "password", required: true },
          ]}
        />
      </div>
    </main>
  );
}
