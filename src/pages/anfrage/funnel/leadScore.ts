import type { FunnelState } from "./types";

/**
 * Client-side lead score (purely informational).
 * Server stays authoritative — see supabase/functions/lead-notify-funnel.
 */
export function clientLeadScore(s: FunnelState): number {
  let score = 0;
  switch (s.people_bucket) {
    case "2-10": score += 5; break;
    case "11-25": score += 10; break;
    case "26-50": score += 20; break;
    case "51-100": score += 25; break;
    case "100+": score += 30; break;
  }
  switch (s.date_mode) {
    case "fixed": score += 25; break;
    case "flexible": score += 15; break;
    case "open": score += 5; break;
  }
  if (s.occasion && s.occasion !== "sonstiges") score += 15;
  else if (s.occasion === "sonstiges" && s.occasion_other) score += 10;
  switch (s.intent) {
    case "delivery": score += 20; break;
    case "inhouse": score += 20; break;
    case "consult": score += 10; break;
  }
  return Math.min(100, score);
}