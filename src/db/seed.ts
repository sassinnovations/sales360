import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "../lib/password";

const TENANT = "ten_northstar";
const PRIYA = "usr_priya";
const ARUN = "usr_arun";
const LEAH = "usr_leah";
const ROHAN = "usr_rohan";
const MAYA = "usr_maya";
const NORA = "usr_nora";
const SAM = "usr_sam";

function iso(days: number) {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function seedIfEmpty(db: DatabaseSync) {
  const existing = db.prepare("select count(*) as count from tenants").get() as { count: number };
  if (Number(existing.count) > 0) return;

  const now = iso(0);
  const password = hashPassword("Sales360!");
  const ownerPassword = hashPassword("Sass@2021");
  const insert = db.prepare.bind(db);

  const run = (sql: string, ...params: (string | number | null)[]) => {
    insert(sql).run(...params);
  };

  db.exec("BEGIN");
  try {
    run(
      `insert into tenants (id, name, legal_name, slug, industry, company_size, website, country, timezone, currency, profile, mfa_required, approval_discount_pct, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      TENANT,
      "Northstar Systems",
      "Northstar Systems Pvt. Ltd.",
      "northstar",
      "IT services & staffing",
      "51-200",
      "https://northstar.example",
      "India",
      "Asia/Kolkata",
      "INR",
      "combined",
      0,
      10,
      now,
    );

    const people: [string, string, string, string, string, string, string][] = [
      [PRIYA, "Priya Shah", "info@sassinnovations.com", "owner", "Leadership", "Managing Director", "+91 98000 10001"],
      [ARUN, "Arun Mehta", "arun.mehta@northstar.example", "manager", "Sales", "Sales Manager", "+91 98000 10002"],
      [LEAH, "Leah Okonkwo", "leah.okonkwo@northstar.example", "bdm", "Sales", "Business Development Manager", "+91 98000 10003"],
      [ROHAN, "Rohan Iyer", "rohan.iyer@northstar.example", "recruiter", "Resourcing", "Lead Recruiter", "+91 98000 10004"],
      [MAYA, "Maya Chen", "maya.chen@northstar.example", "delivery", "Delivery", "Account Manager", "+91 98000 10005"],
      [NORA, "Nora Khan", "nora.khan@northstar.example", "finance", "Commercial", "Commercial Lead", "+91 98000 10006"],
      [SAM, "Sam Patel", "sam.patel@northstar.example", "auditor", "Assurance", "Internal Auditor", "+91 98000 10007"],
    ];
    for (const [id, name, email, role, team, title, phone] of people) {
      run(
        `insert into users (id, tenant_id, name, email, password_hash, role, team, title, phone, status, mfa_enabled, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)`,
        id,
        TENANT,
        name,
        email,
        id === PRIYA ? ownerPassword : password,
        role,
        team,
        title,
        phone,
        now,
      );
    }

    const lists: [string, string[]][] = [
      ["lead_sources", ["Website", "Referral", "Campaign", "Partner", "Event", "Inbound call"]],
      ["industries", ["Banking", "Healthcare", "Logistics", "Retail", "Insurance", "Technology"]],
      ["lost_reasons", ["Budget", "Timing", "Competitor", "No decision", "Poor fit"]],
      ["service_lines", ["IT Services and Consulting", "Staffing", "Managed services","Data & AI"]],
      ["account_types", ["Prospect", "Customer", "Partner"]],
    ];
    for (const [key, value] of lists) {
      run(`insert into settings (tenant_id, key, value) values (?, ?, ?)`, TENANT, key, JSON.stringify(value));
    }

    run(
      `insert into pipelines (id, tenant_id, name, is_default) values ('pip_services', ?, 'IT services', 1)`,
      TENANT,
    );
    const stages: [string, string, number, number, string][] = [
      ["stg_disc", "Discovery", 25, 1, "open"],
      ["stg_prop", "Value Proposition", 50, 2, "open"],
      ["stg_qual", "Qualification", 10, 3, "open"],
      ["stg_neg", "Negotiation", 75, 4, "open"],
      ["stg_won", "Closed Won", 100, 5, "won"],
      ["stg_lost", "Closed Lost", 0, 6, "lost"],
    ];
    for (const [id, name, probability, sort, kind] of stages) {
      run(
        `insert into stages (id, tenant_id, pipeline_id, name, probability, sort_order, kind) values (?, ?, 'pip_services', ?, ?, ?, ?)`,
        id,
        TENANT,
        name,
        probability,
        sort,
        kind,
      );
    }

    const accounts: [string, string, string, string, string, string, string, string, string, string][] = [
      ["acc_meridian", "Meridian Bank", "Customer", "Banking", "https://meridian.example", "West", "India", LEAH, "Watch", "Proposal is in review and an earlier SOC bid was lost on budget."],
      ["acc_lumen", "Lumen Health", "Customer", "Healthcare", "https://lumen.example", "South", "India", LEAH, "Strong", "Discovery is active and delivery has one open case inside SLA."],
      ["acc_orbit", "Orbit Logistics", "Prospect", "Logistics", "https://orbit.example", "West", "India", ARUN, "Strong", "Negotiation is moving and a data-engineer requirement is in market."],
      ["acc_kite", "Kite Retail", "Prospect", "Retail", "https://kite.example", "North", "India", LEAH, "Watch", "Early-stage rollout. Buying group is still forming."],
      ["acc_harbor", "Harbor Insurance", "Customer", "Insurance", "https://harbor.example", "West", "India", ARUN, "Strong", "Closed-won claims work and a live service-desk placement."],
    ];
    for (const [id, name, type, industry, website, region, country, owner, health, reason] of accounts) {
      run(
        `insert into accounts (id, tenant_id, name, type, industry, website, region, country, owner_id, status, health, health_reason, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, 1)`,
        id,
        TENANT,
        name,
        type,
        industry,
        website,
        region,
        country,
        owner,
        health,
        reason,
        iso(-120),
        now,
      );
    }

    const contacts: [string, string, string, string, string, string, string, string, string, string, number][] = [
      ["con_helen", "acc_meridian", "Helen Cho", "Chief Information Officer", "Technology", "helen.cho@meridian.example", "+91 98111 20001", "Mumbai", "Economic buyer", "opted_in", 1],
      ["con_farah", "acc_lumen", "Farah Iqbal", "VP Digital", "Digital", "farah.iqbal@lumen.example", "+91 98111 20002", "Bengaluru", "Champion", "opted_in", 1],
      ["con_chris", "acc_orbit", "Chris Adeyemi", "Chief Operating Officer", "Operations", "chris.adeyemi@orbit.example", "+91 98111 20003", "Pune", "Economic buyer", "opted_out", 1],
      ["con_meera", "acc_kite", "Meera Nair", "Head of Stores", "Retail operations", "meera.nair@kite.example", "+91 98111 20004", "Delhi", "Influencer", "opted_in", 1],
      ["con_paul", "acc_harbor", "Paul Greene", "Director of Claims", "Claims", "paul.greene@harbor.example", "+91 98111 20005", "Mumbai", "Champion", "opted_in", 1],
    ];
    for (const [id, account, name, title, department, email, phone, location, role, consent, primary] of contacts) {
      run(
        `insert into contacts (id, tenant_id, account_id, name, title, department, email, phone, location, buying_role, channel, consent, is_primary, owner_id, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Email', ?, ?, ?, ?, ?, 1)`,
        id,
        TENANT,
        account,
        name,
        title,
        department,
        email,
        phone,
        location,
        role,
        consent,
        primary,
        LEAH,
        iso(-90),
        now,
      );
      run(`insert into contact_accounts (contact_id, account_id) values (?, ?)`, id, account);
    }

    const leads: [string, string, string, string, string, string, string, string, string, number, string, string][] = [
      ["ld_anika", "Anika Rao", "Pixel Forge", "Chief Marketing Officer", "anika.rao@pixelforge.example", "+91 98450 11021", "Website", "Working", LEAH, 62, '["Work email is on file","Company is identified","Engaged this week"]', "Asked for a staffing-plus-build option for a campaign site."],
      ["ld_dev", "Dev Kapoor", "Brightline Insurance", "Head of IT", "dev.kapoor@brightline.example", "+91 98450 11022", "Referral", "Working", LEAH, 78, '["Referral source","Work email is on file","Phone number is available","Title suggests buying influence"]', "Referred by Paul Greene. Wants a claims-automation conversation."],
      ["ld_sara", "Sara Lind", "Northwind Clinics", "Chief Operating Officer", "sara.lind@northwind.example", "+91 98450 11023", "Event", "Qualified", LEAH, 84, '["Marked qualified","Event source with a stated timeline","Work email and phone are on file"]', "Met at the healthcare forum. Budget window is this quarter."],
      ["ld_jonah", "Jonah Ellis", "Fieldstone Manufacturing", "Plant Director", "jonah.ellis@fieldstone.example", "+91 98450 11024", "Campaign", "New", ARUN, 35, '["Company is identified","No recent engagement"]', "Downloaded a briefing. No reply to the first call."],
      ["ld_kite", "Meera Nair", "Kite Retail", "Head of Stores", "meera.nair@kite.example", "+91 98111 20004", "Partner", "Converted", LEAH, 70, '["Converted to account, contact, and opportunity"]', "Converted after a partner introduction."],
    ];
    for (const [id, name, company, title, email, phone, source, status, owner, score, reasons, notes] of leads) {
      run(
        `insert into leads (id, tenant_id, name, first_name, last_name, company, title, email, phone, source, status, owner_id, score, score_reasons, score_updated_at, notes, account_id, contact_id, opportunity_id, converted_at, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        TENANT,
        name,
        name.split(" ")[0],
        name.split(" ").slice(1).join(" "),
        company,
        title,
        email,
        phone,
        source,
        status,
        owner,
        score,
        reasons,
        now,
        notes,
        id === "ld_kite" ? "acc_kite" : null,
        id === "ld_kite" ? "con_meera" : null,
        id === "ld_kite" ? "opp_kite" : null,
        id === "ld_kite" ? iso(-12) : null,
        iso(id === "ld_jonah" ? -28 : -6),
        now,
      );
    }

    const opps: [string, string, string, string, string, string, number, string, string, string, string, string | null][] = [
      ["opp_meridian", "Core banking modernization", "acc_meridian", "con_helen", LEAH, "stg_prop", 4800000, iso(30), "IT Services and Consulting", "open", "Referral", null],
      ["opp_lumen", "Patient portal rebuild", "acc_lumen", "con_farah", LEAH, "stg_disc", 2200000, iso(40), "IT Services and Consulting", "open", "Inbound call", null],
      ["opp_orbit", "Warehouse platform", "acc_orbit", "con_chris", ARUN, "stg_neg", 6100000, iso(14), "IT Services and Consulting", "open", "Partner", null],
      ["opp_kite", "Store systems rollout", "acc_kite", "con_meera", LEAH, "stg_qual", 900000, iso(50), "Staffing", "open", "Partner", null],
      ["opp_harbor", "Claims copilot", "acc_harbor", "con_paul", ARUN, "stg_won", 3500000, iso(-20), "Data & AI", "won", "Referral", null],
      ["opp_soc", "Managed SOC retainer", "acc_meridian", "con_helen", LEAH, "stg_lost", 1200000, iso(-8), "Managed services", "lost", "Campaign", "Budget"],
    ];
    for (const [id, name, account, contact, owner, stage, amount, close, line, status, source, lost] of opps) {
      const probability = stage === "stg_prop" ? 50 : stage === "stg_disc" ? 25 : stage === "stg_neg" ? 75 : stage === "stg_qual" ? 10 : stage === "stg_won" ? 100 : 0;
      run(
        `insert into opportunities (id, tenant_id, name, account_id, contact_id, owner_id, source, pipeline_id, stage_id, amount, currency, probability, close_date, service_line, status, lost_reason, closed_at, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, 'pip_services', ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        TENANT,
        name,
        account,
        contact,
        owner,
        source,
        stage,
        amount,
        probability,
        close,
        line,
        status,
        lost,
        status === "open" ? null : close,
        iso(-40),
        now,
      );
      run(
        `insert into stage_history (id, tenant_id, opportunity_id, from_stage, to_stage, actor_id, created_at)
         values (?, ?, ?, 'Qualification', ?, ?, ?)`,
        `hist_${id}`,
        TENANT,
        id,
        stage === "stg_qual" ? "Qualification" : stage === "stg_disc" ? "Discovery" : stage === "stg_prop" ? "Value Proposition" : stage === "stg_neg" ? "Negotiation" : stage === "stg_won" ? "Closed Won" : "Closed Lost",
        owner,
        iso(-3),
      );
    }

    const activities: [string, string, string, string, string, string, string, string, string, string | null][] = [
      ["act_anika", "task", "Call Anika Rao about the campaign site", "Confirm budget owner and whether they want staff or a fixed-scope build.", "open", "High", iso(-1), LEAH, "lead", "ld_anika"],
      ["act_today", "task", "Send Lumen discovery agenda", "Include integration constraints Farah raised last week.", "open", "Normal", iso(0), LEAH, "opportunity", "opp_lumen"],
      ["act_lumen", "meeting", "Lumen discovery workshop", "On-site session with digital and clinical operations.", "open", "High", iso(2), LEAH, "opportunity", "opp_lumen"],
      ["act_orbit", "task", "Prepare Orbit negotiation brief", "Commercial range stays inside the approved discount threshold.", "open", "High", iso(1), ARUN, "opportunity", "opp_orbit"],
      ["act_harbor", "call", "Harbor kickoff call", "Placement and claims scope confirmed with Paul.", "completed", "Normal", iso(-10), ARUN, "account", "acc_harbor"],
      ["act_note", "note", "Proposal assumptions for Meridian", "Phase 1 is core customer onboarding. Data migration is a separate option.", "completed", "Normal", iso(-2), LEAH, "opportunity", "opp_meridian"],
    ];
    for (const [id, type, subject, body, status, priority, due, owner, relatedType, relatedId] of activities) {
      run(
        `insert into activities (id, tenant_id, type, subject, body, status, priority, due_at, owner_id, related_type, related_id, outcome, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        id,
        TENANT,
        type,
        subject,
        body,
        status,
        priority,
        due,
        owner,
        relatedType,
        relatedId,
        status === "completed" ? "Completed as planned" : null,
        iso(-5),
        now,
      );
    }

    run(
      `insert into requirements (id, tenant_id, account_id, title, skills, experience, location, work_mode, employment_type, rate_min, rate_max, currency, positions, priority, owner_id, status, start_date, target_date, description, must_have, nice_to_have, hiring_manager, created_at, updated_at, version)
       values ('req_java', ?, 'acc_lumen', 'Senior Java engineer', 'Java, Spring, PostgreSQL', '7+ years', 'Bengaluru', 'Hybrid', 'Contract', 1800, 2400, 'INR', 2, 'High', ?, 'Sourcing', ?, ?, 'Build the patient-portal service layer.', 'Java, Spring Boot, healthcare domain exposure', 'Kafka', 'Farah Iqbal', ?, ?, 1)`,
      TENANT, ROHAN, iso(14), iso(21), iso(-4), now,
    );
    run(
      `insert into requirements (id, tenant_id, account_id, title, skills, experience, location, work_mode, employment_type, rate_min, rate_max, currency, positions, priority, owner_id, status, start_date, target_date, description, must_have, hiring_manager, created_at, updated_at, version)
       values ('req_snow', ?, 'acc_meridian', 'ServiceNow consultant', 'ServiceNow, ITSM, CMDB', '8+ years', 'Mumbai', 'Hybrid', 'Contract', 2500, 3200, 'INR', 1, 'High', ?, 'Interviewing', ?, ?, 'Stabilize ITSM before the core-banking program.', 'ServiceNow ITSM', 'Helen Cho', ?, ?, 1)`,
      TENANT, ROHAN, iso(7), iso(18), iso(-9), now,
    );
    run(
      `insert into requirements (id, tenant_id, account_id, title, skills, experience, location, work_mode, employment_type, rate_min, rate_max, currency, positions, priority, owner_id, status, target_date, description, must_have, hiring_manager, created_at, updated_at, version)
       values ('req_data', ?, 'acc_orbit', 'Data engineer', 'Python, dbt, Snowflake', '5+ years', 'Pune', 'Remote', 'Contract', 2000, 2600, 'INR', 1, 'Normal', ?, 'Submitted', ?, 'Warehouse and control-tower data model.', 'Python, SQL, dbt', 'Chris Adeyemi', ?, ?, 1)`,
      TENANT, ROHAN, iso(20), iso(-6), now,
    );
    run(
      `insert into requirements (id, tenant_id, account_id, title, skills, experience, location, work_mode, employment_type, rate_min, rate_max, currency, positions, priority, owner_id, status, start_date, description, hiring_manager, created_at, updated_at, version)
       values ('req_desk', ?, 'acc_harbor', 'Service desk analyst', 'ITIL, ServiceNow', '4+ years', 'Mumbai', 'On-site', 'Contract', 900, 1300, 'INR', 1, 'Normal', ?, 'Filled', ?, 'Claims service desk coverage.', 'Paul Greene', ?, ?, 1)`,
      TENANT, ROHAN, iso(-20), iso(-30), now,
    );

    const candidates: [string, string, string, string, string, number, string, string, number, string, string][] = [
      ["can_aisha", "Aisha Rahman", "aisha.rahman@example.com", "+91 99000 30001", "Java, Spring, PostgreSQL", 8, "Bengaluru", "Immediate", 2200, "Portal", "Backend engineer for regulated products."],
      ["can_vikram", "Vikram Desai", "vikram.desai@example.com", "+91 99000 30002", "ServiceNow, ITSM, CMDB", 11, "Mumbai", "Two weeks", 3000, "Referral", "Led two bank ITSM rollouts."],
      ["can_elena", "Elena Rossi", "elena.rossi@example.com", "+91 99000 30003", "Python, dbt, Snowflake", 6, "Pune", "Immediate", 2400, "LinkedIn", "Analytics engineer, open to contract."],
      ["can_kabir", "Kabir Shah", "kabir.shah@example.com", "+91 99000 30004", "Java, React", 4, "Hyderabad", "Immediate", 1600, "Job board", "Strong coder, light healthcare exposure."],
      ["can_imran", "Imran Qureshi", "imran.qureshi@example.com", "+91 99000 30005", "ITIL, ServiceNow", 7, "Mumbai", "Placed", 850, "Referral", "On assignment at Harbor Insurance."],
    ];
    for (const [id, name, email, phone, skills, years, location, availability, rate, source, summary] of candidates) {
      run(
        `insert into candidates (id, tenant_id, name, email, phone, skills, experience_years, location, work_auth, availability, rate_expectation, currency, source, status, summary, consent, owner_id, parse_status, created_at, updated_at, version)
         values (?, ?, ?, ?, ?, ?, ?, ?, 'India — work authorized', ?, ?, 'INR', ?, ?, ?, 'granted', ?, 'none', ?, ?, 1)`,
        id,
        TENANT,
        name,
        email,
        phone,
        skills,
        years,
        location,
        availability,
        rate,
        source,
        id === "can_imran" ? "Placed" : "Active",
        summary,
        ROHAN,
        iso(-15),
        now,
      );
    }

    run(
      `insert into submissions (id, tenant_id, candidate_id, requirement_id, recruiter_id, proposed_rate, currency, status, notes, created_at, updated_at, version)
       values ('sub_aisha', ?, 'can_aisha', 'req_java', ?, 2200, 'INR', 'Submitted', 'Profile matches the must-have Java stack.', ?, ?, 1)`,
      TENANT, ROHAN, iso(-2), now,
    );
    run(
      `insert into submissions (id, tenant_id, candidate_id, requirement_id, recruiter_id, proposed_rate, currency, status, notes, created_at, updated_at, version)
       values ('sub_vikram', ?, 'can_vikram', 'req_snow', ?, 3000, 'INR', 'Interview', 'Client asked for a second round.', ?, ?, 1)`,
      TENANT, ROHAN, iso(-6), now,
    );
    run(
      `insert into submissions (id, tenant_id, candidate_id, requirement_id, recruiter_id, proposed_rate, currency, status, notes, created_at, updated_at, version)
       values ('sub_elena', ?, 'can_elena', 'req_data', ?, 2400, 'INR', 'Client Review', 'Submitted with a short case study.', ?, ?, 1)`,
      TENANT, ROHAN, iso(-1), now,
    );
    run(
      `insert into submissions (id, tenant_id, candidate_id, requirement_id, recruiter_id, proposed_rate, currency, status, notes, created_at, updated_at, version)
       values ('sub_imran', ?, 'can_imran', 'req_desk', ?, 1100, 'INR', 'Selected', 'Selected for the Harbor desk.', ?, ?, 1)`,
      TENANT, ROHAN, iso(-25), now,
    );

    run(
      `insert into interviews (id, tenant_id, submission_id, round_name, scheduled_at, mode, participants, feedback, outcome, created_at)
       values ('int_v1', ?, 'sub_vikram', 'Round 1 — ITSM depth', ?, 'Video', 'Helen Cho, Rohan Iyer', 'Strong CMDB examples. Client wants a commercial round.', 'Advance', ?)`,
      TENANT, iso(-3), iso(-3),
    );
    run(
      `insert into interviews (id, tenant_id, submission_id, round_name, scheduled_at, mode, participants, outcome, created_at)
       values ('int_v2', ?, 'sub_vikram', 'Round 2 — commercial fit', ?, 'Video', 'Helen Cho, Nora Khan', 'Scheduled', ?)`,
      TENANT, iso(3), now,
    );

    run(
      `insert into placements (id, tenant_id, submission_id, account_id, candidate_id, requirement_id, role, start_date, end_date, bill_rate, pay_rate, currency, owner_id, status, notes, renewal_date, created_at, updated_at, version)
       values ('plc_imran', ?, 'sub_imran', 'acc_harbor', 'can_imran', 'req_desk', 'Service desk analyst', ?, ?, 1100, 850, 'INR', ?, 'Active', 'Extend if claims volume stays above plan.', ?, ?, ?, 1)`,
      TENANT, iso(-20), iso(160), MAYA, iso(25), iso(-20), now,
    );

    run(
      `insert into proposals (id, tenant_id, opportunity_id, account_id, name, status, currency, valid_until, discount_pct, tax_pct, owner_id, version_no, notes, created_at, updated_at, version)
       values ('prop_meridian', ?, 'opp_meridian', 'acc_meridian', 'Meridian phase-1 proposal', 'Internal Review', 'INR', ?, 15, 18, ?, 2, 'Discount is above the 10% approval threshold.', ?, ?, 1)`,
      TENANT, iso(21), LEAH, iso(-2), now,
    );
    run(
      `insert into proposal_items (id, proposal_id, description, quantity, rate, position) values
       ('pi_1', 'prop_meridian', 'Discovery and solution design', 1, 600000, 1),
       ('pi_2', 'prop_meridian', 'Core onboarding build', 1, 4200000, 2)`,
    );

    run(
      `insert into contracts (id, tenant_id, account_id, name, status, start_date, end_date, value, currency, owner_id, renewal_lead_days, notes, created_at, updated_at, version)
       values ('ctr_harbor', ?, 'acc_harbor', 'Harbor claims services agreement', 'Active', ?, ?, 3500000, 'INR', ?, 30, 'Renewal conversation due with Paul Greene.', ?, ?, 1)`,
      TENANT, iso(-200), iso(25), ARUN, iso(-200), now,
    );

    run(
      `insert into cases (id, tenant_id, account_id, contact_id, subject, description, category, priority, owner_id, status, sla_due_at, created_at, updated_at, version)
       values ('case_lumen', ?, 'acc_lumen', 'con_farah', 'Portal test-login failing for clinicians', 'Clinicians on the pilot list cannot complete MFA enrollment.', 'Access', 'High', ?, 'In Progress', ?, ?, ?, 1)`,
      TENANT, MAYA, iso(1), iso(-1), now,
    );
    run(
      `insert into case_notes (id, case_id, author_id, body, visibility, created_at)
       values ('cn_1', 'case_lumen', ?, 'Identity provider group mapping is the likely cause. Customer-visible update drafted, not sent.', 'internal', ?)`,
      MAYA, now,
    );

    run(
      `insert into campaigns (id, tenant_id, name, objective, type, owner_id, start_date, end_date, budget, status, attribution, created_at, updated_at, version)
       values ('camp_q4', ?, 'Q4 banking IT outreach', 'Book discovery meetings with bank technology leaders.', 'Email', ?, ?, ?, 250000, 'Active', 'First touch', ?, ?, 1)`,
      TENANT, LEAH, iso(-10), iso(20), iso(-10), now,
    );
    run(
      `insert into campaign_members (id, campaign_id, contact_id, status) values
       ('cm_1', 'camp_q4', 'con_helen', 'Ready'),
       ('cm_2', 'camp_q4', 'con_chris', 'Suppressed')`,
    );

    run(
      `insert into workflow_rules (id, tenant_id, name, trigger, condition_json, action_type, action_json, active, created_at)
       values ('rule_proposal', ?, 'Follow up when a deal reaches Proposal', 'opportunity.stage', ?, 'create_task', ?, 1, ?)`,
      TENANT,
      JSON.stringify({ toStage: "Value Proposition" }),
      JSON.stringify({ subject: "Prepare proposal follow-up", dueInDays: 2 }),
      now,
    );

    run(
      `insert into notifications (id, tenant_id, user_id, title, body, href, created_at) values
       ('ntf_1', ?, ?, 'Task overdue', 'Call Anika Rao about the campaign site.', '/activities?view=overdue', ?),
       ('ntf_2', ?, ?, 'Interview scheduled', 'Vikram Desai, round 2 with Meridian Bank.', '/submissions/sub_vikram', ?),
       ('ntf_3', ?, ?, 'Renewal approaching', 'Harbor claims services agreement ends soon.', '/renewals', ?)`,
      TENANT, LEAH, now,
      TENANT, ROHAN, now,
      TENANT, ARUN, now,
    );

    run(
      `insert into audit_events (id, tenant_id, actor_id, action, record_type, record_id, summary, created_at) values
       ('aud_1', ?, ?, 'convert', 'lead', 'ld_kite', 'Converted Kite Retail lead into account, contact, and opportunity.', ?),
       ('aud_2', ?, ?, 'stage', 'opportunity', 'opp_meridian', 'Moved Core banking modernization to Proposal.', ?),
       ('aud_3', ?, ?, 'placement', 'placement', 'plc_imran', 'Created the Harbor service-desk placement.', ?)`,
      TENANT, LEAH, iso(-12),
      TENANT, LEAH, iso(-3),
      TENANT, MAYA, iso(-20),
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
