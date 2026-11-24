export const SCHEMA = `
create table if not exists tenants (
  id text primary key,
  name text not null,
  legal_name text,
  slug text not null unique,
  industry text,
  company_size text,
  website text,
  country text not null,
  timezone text not null,
  currency text not null,
  profile text not null,
  mfa_required integer not null default 0,
  approval_discount_pct real not null default 10,
  created_at text not null
);

create table if not exists users (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  email text not null,
  password_hash text,
  role text not null,
  team text,
  title text,
  phone text,
  status text not null,
  invite_token text,
  invite_expires text,
  reset_code text,
  reset_expires text,
  mfa_enabled integer not null default 0,
  mfa_code text,
  created_at text not null,
  unique (tenant_id, email)
);

create table if not exists sessions (
  token text primary key,
  user_id text,
  email text,
  kind text not null,
  expires_at text not null,
  created_at text not null
);

create table if not exists login_attempts (
  id text primary key,
  email text not null,
  created_at text not null
);

create table if not exists settings (
  tenant_id text not null,
  key text not null,
  value text not null,
  primary key (tenant_id, key)
);

create table if not exists pipelines (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  is_default integer not null default 0
);

create table if not exists stages (
  id text primary key,
  tenant_id text not null,
  pipeline_id text not null references pipelines(id),
  name text not null,
  probability integer not null,
  sort_order integer not null,
  kind text not null
);

create table if not exists accounts (
  id text primary key,
  tenant_id text not null,
  name text not null,
  type text,
  industry text,
  website text,
  region text,
  country text,
  owner_id text,
  status text not null,
  health text,
  health_reason text,
  parent_id text,
  phone text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists contacts (
  id text primary key,
  tenant_id text not null,
  account_id text,
  name text not null,
  title text,
  department text,
  email text,
  phone text,
  location text,
  buying_role text,
  channel text,
  consent text not null default 'unknown',
  is_primary integer not null default 0,
  owner_id text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists contact_accounts (
  contact_id text not null,
  account_id text not null,
  primary key (contact_id, account_id)
);

create table if not exists leads (
  id text primary key,
  tenant_id text not null,
  name text,
  first_name text,
  last_name text,
  company text,
  title text,
  email text,
  phone text,
  linkedin_url text,
  city text,
  state text,
  country text,
  source text,
  status text not null,
  owner_id text,
  score integer not null default 0,
  score_reasons text,
  score_updated_at text,
  need text,
  budget text,
  authority text,
  timeline_note text,
  fit text,
  service_interest text,
  notes text,
  converted_at text,
  account_id text,
  contact_id text,
  opportunity_id text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists opportunities (
  id text primary key,
  tenant_id text not null,
  name text not null,
  account_id text not null,
  contact_id text,
  owner_id text,
  source text,
  pipeline_id text not null,
  stage_id text not null,
  amount real not null default 0,
  currency text not null,
  probability integer not null default 0,
  close_date text,
  service_line text,
  competitors text,
  status text not null,
  lost_reason text,
  closed_at text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists stage_history (
  id text primary key,
  tenant_id text not null,
  opportunity_id text not null,
  from_stage text,
  to_stage text not null,
  actor_id text,
  created_at text not null
);

create table if not exists activities (
  id text primary key,
  tenant_id text not null,
  type text not null,
  subject text not null,
  body text,
  status text not null,
  priority text,
  due_at text,
  owner_id text,
  related_type text,
  related_id text,
  outcome text,
  source_rule_id text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists requirements (
  id text primary key,
  tenant_id text not null,
  account_id text not null,
  title text not null,
  category text,
  work_authorization text,
  requirement_date text,
  skills text,
  experience text,
  location text,
  work_mode text,
  employment_type text,
  rate_min real,
  rate_max real,
  currency text,
  positions integer not null default 1,
  priority text,
  owner_id text,
  status text not null,
  start_date text,
  target_date text,
  description text,
  must_have text,
  nice_to_have text,
  hiring_manager text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists candidates (
  id text primary key,
  tenant_id text not null,
  name text not null,
  email text,
  phone text,
  skills text,
  experience_years real,
  location text,
  work_auth text,
  availability text,
  rate_expectation real,
  currency text,
  source text,
  status text not null,
  summary text,
  resume_name text,
  resume_path text,
  parsed_json text,
  parse_status text not null default 'none',
  consent text not null default 'unknown',
  owner_id text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists submissions (
  id text primary key,
  tenant_id text not null,
  candidate_id text not null,
  requirement_id text not null,
  recruiter_id text,
  proposed_rate real,
  currency text,
  status text not null,
  notes text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists interviews (
  id text primary key,
  tenant_id text not null,
  submission_id text not null,
  round_name text,
  scheduled_at text,
  mode text,
  participants text,
  feedback text,
  outcome text,
  created_at text not null
);

create table if not exists placements (
  id text primary key,
  tenant_id text not null,
  submission_id text,
  account_id text not null,
  candidate_id text not null,
  requirement_id text,
  role text not null,
  start_date text not null,
  end_date text,
  bill_rate real,
  pay_rate real,
  currency text,
  owner_id text,
  status text not null,
  notes text,
  renewal_date text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists proposals (
  id text primary key,
  tenant_id text not null,
  opportunity_id text,
  account_id text not null,
  name text not null,
  status text not null,
  currency text not null,
  valid_until text,
  discount_pct real not null default 0,
  tax_pct real not null default 18,
  owner_id text,
  version_no integer not null default 1,
  notes text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists proposal_items (
  id text primary key,
  proposal_id text not null,
  description text not null,
  quantity real not null,
  rate real not null,
  position integer not null
);

create table if not exists contracts (
  id text primary key,
  tenant_id text not null,
  account_id text not null,
  proposal_id text,
  name text not null,
  status text not null,
  start_date text not null,
  end_date text not null,
  value real,
  currency text,
  owner_id text,
  renewal_lead_days integer not null default 30,
  notes text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists cases (
  id text primary key,
  tenant_id text not null,
  account_id text not null,
  contact_id text,
  subject text not null,
  description text,
  category text,
  priority text not null,
  owner_id text,
  status text not null,
  sla_due_at text,
  resolution text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists case_notes (
  id text primary key,
  case_id text not null,
  author_id text,
  body text not null,
  visibility text not null,
  created_at text not null
);

create table if not exists campaigns (
  id text primary key,
  tenant_id text not null,
  name text not null,
  objective text,
  type text,
  owner_id text,
  start_date text,
  end_date text,
  budget real,
  status text not null,
  attribution text,
  created_at text not null,
  updated_at text not null,
  version integer not null default 1
);

create table if not exists campaign_members (
  id text primary key,
  campaign_id text not null,
  contact_id text not null,
  status text not null
);

create table if not exists workflow_rules (
  id text primary key,
  tenant_id text not null,
  name text not null,
  trigger text not null,
  condition_json text not null,
  action_type text not null,
  action_json text not null,
  active integer not null default 0,
  created_at text not null
);

create table if not exists workflow_runs (
  id text primary key,
  tenant_id text not null,
  rule_id text not null,
  status text not null,
  detail text,
  created_at text not null
);

create table if not exists audit_events (
  id text primary key,
  tenant_id text not null,
  actor_id text,
  action text not null,
  record_type text,
  record_id text,
  summary text not null,
  created_at text not null
);

create table if not exists notifications (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  title text not null,
  body text,
  href text,
  read_at text,
  created_at text not null
);

create table if not exists ai_feedback (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  record_type text,
  record_id text,
  useful integer not null,
  reason text,
  created_at text not null
);

create index if not exists idx_users_email on users(email);
create index if not exists idx_leads_tenant on leads(tenant_id, status);
create index if not exists idx_accounts_tenant on accounts(tenant_id);
create index if not exists idx_opps_tenant on opportunities(tenant_id, status);
create index if not exists idx_activities_owner on activities(tenant_id, owner_id, status);
create index if not exists idx_audit_tenant on audit_events(tenant_id, created_at);
`;
