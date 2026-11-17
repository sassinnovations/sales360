import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding-form";

export const instant = false;

export default function OnboardingPage() {
  return (
    <main className="auth">
      <section className="auth-story">
        <div>
          <p className="eyebrow" style={{ color: "#e7b15a" }}>Tenant setup</p>
          <h1>Name the company. Choose how it sells. Walk in as the owner.</h1>
        </div>
        <p>General B2B, IT staffing, or both. The draft stays in this browser if you leave.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <OnboardingForm />
          <Link href="/login">I already have a workspace</Link>
        </div>
      </section>
    </main>
  );
}
