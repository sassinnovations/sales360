"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/types";

export type Field = {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  wide?: boolean;
  required?: boolean;
  hint?: string;
};

export function EntityForm({
  action,
  fields,
  hidden,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  hidden?: Record<string, string>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""])),
  );
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return (
    <form
      action={formAction}
      className="card stack"
      noValidate
      onChange={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
        if (!target.name || target instanceof HTMLInputElement && target.type === "file") return;
        setDirty(true);
        const value =
          target instanceof HTMLInputElement && target.type === "checkbox"
            ? target.checked
              ? "yes"
              : ""
            : target.value;
        setValues((current) => ({ ...current, [target.name]: value }));
      }}
    >
      {state?.error ? <p className="warn">{state.error}</p> : null}
      {state?.warning ? <p className="warn">{state.warning}</p> : null}
      {state?.warning ? <input type="hidden" name="confirmDuplicate" value="yes" /> : null}
      {hidden
        ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
        : null}
      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.name} className={`field ${field.wide ? "wide" : ""}`}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.type === "select" ? (
              <select name={field.name} value={values[field.name] ?? ""} onChange={() => undefined}>
                <option value="">Select</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea name={field.name} value={values[field.name] ?? ""} onChange={() => undefined} />
            ) : field.type === "checkbox" ? (
              <input name={field.name} type="checkbox" value="yes" checked={(values[field.name] ?? "") === "yes"} onChange={() => undefined} />
            ) : field.type === "file" ? (
              <input name={field.name} type="file" accept={field.hint} />
            ) : (
              <input name={field.name} type={field.type ?? "text"} value={values[field.name] ?? ""} onChange={() => undefined} />
            )}
            {state?.fieldErrors?.[field.name] ? <p className="err">{state.fieldErrors[field.name]}</p> : null}
          </label>
        ))}
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : state?.warning ? "Save anyway" : submitLabel}
      </button>
    </form>
  );
}
