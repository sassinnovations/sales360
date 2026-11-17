"use client";

import { useActionState, useEffect, useState } from "react";
import { onboard } from "@/lib/actions/auth";

const EMPTY = {
  name: "",
  legalName: "",
  industry: "IT services",
  companySize: "11-50",
  website: "",
  country: "India",
  timezone: "Asia/Kolkata",
  currency: "INR",
  profile: "combined",
  slug: "",
  adminName: "",
  adminEmail: "",
  password: "",
  pipeline: "IT services",
};

export function OnboardingForm() {
  const [state, action, pending] = useActionState(onboard, null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(EMPTY);
  useEffect(() => {
    const saved = localStorage.getItem("sales360-onboarding");
    if (saved) setDraft({ ...EMPTY, ...JSON.parse(saved) });
  }, []);
  useEffect(() => {
    localStorage.setItem("sales360-onboarding", JSON.stringify(draft));
  }, [draft]);
  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      action={action}
      className="stack"
      onSubmit={() => localStorage.removeItem("sales360-onboarding")}
    >
      <p className="eyebrow">Step {step + 1} of 3</p>
      {state?.error ? <p className="warn">{state.error}</p> : null}
      <div className={step === 0 ? "stack" : "stack"} hidden={step !== 0}>
        <label className="field">Organization name *<input name="name" value={draft.name} onChange={set("name")} /></label>
        {state?.fieldErrors?.name ? <p className="err">{state.fieldErrors.name}</p> : null}
        <label className="field">Legal name<input name="legalName" value={draft.legalName} onChange={set("legalName")} /></label>
        <label className="field">Country *<input name="country" value={draft.country} onChange={set("country")} /></label>
        <label className="field">Timezone *<input name="timezone" value={draft.timezone} onChange={set("timezone")} /></label>
        <label className="field">Base currency *<input name="currency" value={draft.currency} onChange={set("currency")} /></label>
      </div>
      <div hidden={step !== 1} className="stack">
        <label className="field">
          Operating profile *
          <select name="profile" value={draft.profile} onChange={set("profile")}>
            <option value="b2b">General B2B</option>
            <option value="staffing">IT services & staffing</option>
            <option value="combined">Combined</option>
          </select>
        </label>
        <label className="field">Industry<input name="industry" value={draft.industry} onChange={set("industry")} /></label>
        <label className="field">Company size<input name="companySize" value={draft.companySize} onChange={set("companySize")} /></label>
        <label className="field">Website<input name="website" value={draft.website} onChange={set("website")} /></label>
        <label className="field">Workspace address<input name="slug" value={draft.slug} onChange={set("slug")} placeholder="Generated from the name if blank" /></label>
        {state?.fieldErrors?.slug ? <p className="err">{state.fieldErrors.slug}</p> : null}
        <label className="field">Default pipeline<input name="pipeline" value={draft.pipeline} onChange={set("pipeline")} /></label>
      </div>
      <div hidden={step !== 2} className="stack">
        <label className="field">Your name *<input name="adminName" value={draft.adminName} onChange={set("adminName")} /></label>
        <label className="field">Work email *<input name="adminEmail" type="email" value={draft.adminEmail} onChange={set("adminEmail")} /></label>
        <label className="field">Password *<input name="password" type="password" value={draft.password} onChange={set("password")} /></label>
        {state?.fieldErrors?.password ? <p className="err">{state.fieldErrors.password}</p> : null}
        <p className="muted">You can leave and come back. This browser keeps the draft until you create the workspace.</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {step > 0 ? (
          <button className="btn-ghost" type="button" onClick={() => setStep((value) => value - 1)}>
            Back
          </button>
        ) : null}
        {step < 2 ? (
          <button className="btn-primary" type="button" onClick={() => setStep((value) => value + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create workspace"}
          </button>
        )}
      </div>
    </form>
  );
}
