export function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isPhone(value: string) {
  return /^\+?[0-9][0-9\s()-]{6,18}$/.test(value);
}

export function isWebsite(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function numberValue(value: FormDataEntryValue | null) {
  const raw = text(value).replace(/,/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function fieldError(fields: Record<string, string>, key: string, message: string) {
  fields[key] = message;
}
