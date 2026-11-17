export function scoreLead(input: {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  status?: string | null;
  source?: string | null;
  daysSinceActivity?: number | null;
}) {
  let score = 20;
  const reasons: string[] = [];
  if (input.email) {
    score += 15;
    reasons.push("Work email is on file");
  }
  if (input.phone) {
    score += 10;
    reasons.push("Phone number is available");
  }
  if (input.company) {
    score += 10;
    reasons.push("Company is identified");
  } else {
    reasons.push("Company is missing, so fit is less certain");
  }
  if (input.title && /chief|head|director|vp|founder|owner/i.test(input.title)) {
    score += 10;
    reasons.push("Title suggests buying influence");
  }
  if (input.status === "Qualified") {
    score += 20;
    reasons.push("Marked qualified");
  }
  if (input.source === "Referral") {
    score += 10;
    reasons.push("Referral source");
  }
  if (input.daysSinceActivity == null) {
    reasons.push("No activity yet, so recency is unknown rather than negative");
  } else if (input.daysSinceActivity <= 7) {
    score += 15;
    reasons.push("Engaged in the last 7 days");
  } else if (input.daysSinceActivity > 21) {
    score -= 10;
    reasons.push("No engagement in the last 21 days");
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}
