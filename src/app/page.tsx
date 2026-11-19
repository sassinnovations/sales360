import Link from "next/link";

export default function HomePage() {
  return (
    <main className="auth">
      <section className="auth-story">
        <div>
          <p className="eyebrow">Sass Innovations · AI Sales360</p>
          <h1>AI-Powered CRM for Sales & Staffing</h1>
        </div>
        <p>B2B pipeline, staffing delivery, and an assistant that answers from records you are allowed to see.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Open the workspace</h2>
          <p className="muted">A Northstar Systems demo is ready, or start a new tenant.</p>
          <Link className="btn-primary" href="/login">Sign in</Link>
          <Link className="btn-ghost" href="/onboarding">Create a workspace</Link>
        </div>
      </section>
    </main>
  );
}
