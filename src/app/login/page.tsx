import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { q } from "@/lib/search";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const notice = q((await searchParams).notice);
  return (
    <main className="login-screen">
      <div className="login-shell">
        <section className="login-story">
          <div className="brand">
            <div className="mark">A</div>
            <strong>AI Sales360</strong>
          </div>
          <div>
            <h1>AI-Powered CRM for Sales & Staffing</h1>
            <p>Manage leads, opportunities, customers and IT staffing — all in one platform.</p>
            <ul className="checks">
              <li>✓ Grow your sales pipeline</li>
              <li>✓ Find the right talent faster</li>
              <li>✓ Get AI-driven insights</li>
            </ul>
          </div>
          <svg className="login-waves" viewBox="0 0 640 260" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 90 C 90 150, 170 20, 280 90 S 450 180, 640 70 V 260 H 0 Z" fill="rgba(255,255,255,0.1)" />
            <path d="M0 140 C 140 70, 230 200, 360 130 S 520 40, 640 120 V 260 H 0 Z" fill="rgba(255,255,255,0.14)" />
            <path d="M0 180 C 160 140, 260 230, 420 170 S 540 120, 640 160 V 260 H 0 Z" fill="rgba(255,255,255,0.2)" />
          </svg>
        </section>
        <section className="login-panel">
          <div className="login-card">
            {notice ? <p className="banner">{notice}</p> : null}
            <div>
              <h2>Welcome back</h2>
              <p className="lede">Sign in to your AI Sales360 account</p>
            </div>
            <LoginForm />
            <p className="login-foot">
              Don&apos;t have an account? <Link href="/onboarding" className="text-link">Create Organization</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
