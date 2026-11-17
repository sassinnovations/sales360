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
    <main className="auth">
      <section className="auth-story">
        <div>
          <p className="eyebrow" style={{ color: "#e7b15a" }}>AI Sales360</p>
          <h1>Sign in to the book of work you actually own.</h1>
        </div>
        <p>Demo password for every Northstar user is Sales360!</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          {notice ? <p className="banner">{notice}</p> : null}
          <h2>Welcome back</h2>
          <LoginForm />
          <p>
            <Link href="/forgot">Forgot password</Link> · <Link href="/onboarding">New workspace</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
