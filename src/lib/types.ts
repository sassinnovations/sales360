export const ROLES = [
  "owner",
  "admin",
  "manager",
  "bdm",
  "recruiter",
  "delivery",
  "finance",
  "auditor",
] as const;

export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  team: string;
  title: string;
  status: string;
  tenantName: string;
  currency: string;
  timezone: string;
  profile: string;
  slug: string;
  mfaRequired: boolean;
  approvalDiscountPct: number;
};

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  warning?: string;
  duplicateId?: string;
} | null;

export type SourceLink = { href: string; label: string };

export type AssistantReply = {
  kind: "answer" | "unknown" | "draft";
  text: string;
  sources: SourceLink[];
  draft?: {
    subject: string;
    body: string;
    relatedType: string;
    relatedId: string;
  };
};
