import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-panel">
      <div className="auth-card">
        <h1>That record isn't available</h1>
        <p className="muted">It may be outside your workspace or your role. The app does not say which.</p>
        <Link className="btn-primary" href="/dashboard">Back to the dashboard</Link>
      </div>
    </main>
  );
}
