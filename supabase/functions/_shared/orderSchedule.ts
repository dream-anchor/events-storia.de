// Termin-Regeln des Catering-Checkouts serverseitig (bisher nur als Hinweis im Browser, jetzt auch am Server erzwungen):
//  * Catering: mindestens 24 Stunden Vorlauf; Pizza-only: mindestens 1 Stunde und nur 12:00-14:30 / 18:00-22:30
//  * Lieferung für Samstag/Sonntag: bis Donnerstag 23:59 (Samstag: 2 Tage vorher, Sonntag: 3 Tage vorher)
//  * Samstag/Sonntag: Catering-Lieferung UND -Abholung frühestens 12:00 (Restaurant öffnet Sa-So um 12:00; Inhaber-Entscheidung 22.11.2026).
//    Pizza behält ihre eigenen Zeitfenster (12:00-14:30 / 18:00-22:30), die ohnehin ab 12:00 liegen.
//  * Kein Enddatum: Bestellungen sind beliebig weit im Voraus möglich. Einziges Limit ist ein technisches Sicherheitslimit gegen
//    Tippfehler/Unsinn (MAX_ADVANCE_DAYS = 730 Tage ab heute, Berliner Datum); es ist keine fachliche Grenze.
//  * Event-Buchungen: keine dieser Regeln (wie im Checkout)
// Zeiten sind Berlin-Ortszeit. Reine Funktion.
import { berlinParts, berlinToUtc } from "./giftPricing.ts";

export type ScheduleReject = "schedule_lead_time" | "schedule_pizza_window" | "schedule_pizza_lead_time" | "schedule_weekend_cutoff" | "schedule_weekend_open" | "schedule_too_far";

/** Technisches Sicherheitslimit (kein Geschäftsregel-Ende): 2 Jahre im Voraus. */
export const MAX_ADVANCE_DAYS = 730;
/** Früheste Uhrzeit für Catering am Samstag/Sonntag (Restaurant öffnet dann um 12:00). */
export const WEEKEND_EARLIEST_TIME = "12:00";

const pad = (n: number) => String(n).padStart(2, "0");

function minusDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function checkOrderSchedule(p: { kind: "catering" | "event"; isPickup: boolean; isPizzaOnly: boolean; date: string; time: string }, now: Date): ScheduleReject | null {
  if (p.kind === "event") return null;
  if (p.date > minusDays(berlinParts(now).date, -MAX_ADVANCE_DAYS)) return "schedule_too_far";
  const dow = new Date(`${p.date}T12:00:00Z`).getUTCDay(); // 0 So, 6 Sa
  if (!p.isPickup && (dow === 0 || dow === 6)) {
    const deadline = berlinToUtc(minusDays(p.date, dow === 6 ? 2 : 3), "23:59");
    if (now.getTime() > deadline.getTime() + 59_000) return "schedule_weekend_cutoff";
  }
  const at = berlinToUtc(p.date, p.time).getTime();
  if (p.isPizzaOnly) {
    const [h, m] = p.time.split(":").map(Number);
    const t = h * 60 + m;
    const ok = (t >= 12 * 60 && t <= 14 * 60 + 30) || (t >= 18 * 60 && t <= 22 * 60 + 30);
    if (!ok) return "schedule_pizza_window";
    if (at < now.getTime() + 3600_000) return "schedule_pizza_lead_time";
    return null;
  }
  if ((dow === 0 || dow === 6) && p.time < WEEKEND_EARLIEST_TIME) return "schedule_weekend_open";
  if (at < now.getTime() + 24 * 3600_000) return "schedule_lead_time";
  return null;
}
