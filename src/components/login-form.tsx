"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";

const DEMOS = [
  ["Leah Okonkwo", "BDM", "leah.okonkwo@northstar.example"],
  ["Arun Mehta", "Sales manager", "arun.mehta@northstar.example"],
  ["Rohan Iyer", "Recruiter", "rohan.iyer@northstar.example"],
  ["Priya Shah", "Owner", "info@sassinnovations.com"],
];

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.5.4 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [email, setEmail] = useState("info@sassinnovations.com");
  const [password, setPassword] = useState("Sass@2021");
  const [googleNote, setGoogleNote] = useState("");
  return (
    <form action={action} className="stack login-form">
      {state?.error ? <p className="warn">{state.error}</p> : null}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          placeholder="john@sassinnovations.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <div className="login-row">
        <label className="remember">
          <input name="remember" type="checkbox" />
          Remember me
        </label>
        <Link href="/forgot" className="text-link">Forgot password?</Link>
      </div>
      <button className="btn-primary" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="or">or continue with</div>
      <button className="google-btn" type="button" onClick={() => setGoogleNote("Google sign-in is not connected in this build.")}>
        <GoogleMark />
        Sign in with Google
      </button>
      {googleNote ? <p className="muted" style={{ margin: 0, textAlign: "center" }}>{googleNote}</p> : null}
      <details className="login-demos">
        <summary>Demo accounts</summary>
        <div className="demo">
          {DEMOS.map(([name, role, address]) => (
            <button
              key={address}
              type="button"
              onClick={() => {
                setEmail(address);
                setPassword(address === "info@sassinnovations.com" ? "Sass@2021" : "Sales360!");
              }}
            >
              {name} · {role}
            </button>
          ))}
        </div>
      </details>
    </form>
  );
}
