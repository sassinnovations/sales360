"use client";

import { useActionState, useState } from "react";
import { login } from "@/lib/actions/auth";

const DEMOS = [
  ["Leah Okonkwo", "BDM", "leah.okonkwo@northstar.example"],
  ["Arun Mehta", "Sales manager", "arun.mehta@northstar.example"],
  ["Rohan Iyer", "Recruiter", "rohan.iyer@northstar.example"],
  ["Priya Shah", "Owner", "priya.shah@northstar.example"],
  ["Sam Patel", "Auditor", "sam.patel@northstar.example"],
];

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  const [email, setEmail] = useState("leah.okonkwo@northstar.example");
  const [password, setPassword] = useState("Sales360!");
  return (
    <form action={action} className="stack">
      {state?.error ? <p className="warn">{state.error}</p> : null}
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <div className="demo">
        {DEMOS.map(([name, role, address]) => (
          <button
            key={address}
            type="button"
            className="btn-ghost"
            onClick={() => {
              setEmail(address);
              setPassword("Sales360!");
            }}
          >
            {name} · {role}
          </button>
        ))}
      </div>
    </form>
  );
}
