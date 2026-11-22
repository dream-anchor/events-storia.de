/**
 * Termin-Regeln des Catering-Checkouts (Spiegel von supabase/functions/_shared/orderSchedule.ts; importfrei, in Deno getestet,
 * Paritätstest gegen die Server-Fassung). Der Server erzwingt sie hart; der Checkout blockiert vorher, BEVOR eine Korb-Bestellung
 * angelegt wird. Zeiten sind Berlin-Ortszeit.
 */
export type ScheduleReject = 'schedule_lead_time' | 'schedule_pizza_window' | 'schedule_pizza_lead_time' | 'schedule_weekend_cutoff';

const pad = (n: number) => String(n).padStart(2, '0');

/** Berliner Wandzeit (Datum + HH:MM) als UTC-Zeitpunkt (DST-sicher über Intl). */
function berlinToUtcMs(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  let guess = new Date(`${date}T${pad(h)}:${pad(m)}:00Z`).getTime();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const wanted = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), h, m);
    const diff = shown - wanted;
    if (diff === 0) break;
    guess -= diff;
  }
  return guess;
}

function minusDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function checkOrderSchedule(p: { kind: 'catering' | 'event'; isPickup: boolean; isPizzaOnly: boolean; date: string; time: string }, now: Date): ScheduleReject | null {
  if (p.kind === 'event') return null;
  const dow = new Date(`${p.date}T12:00:00Z`).getUTCDay();
  if (!p.isPickup && (dow === 0 || dow === 6)) {
    const deadline = berlinToUtcMs(minusDays(p.date, dow === 6 ? 2 : 3), '23:59');
    if (now.getTime() > deadline + 59_000) return 'schedule_weekend_cutoff';
  }
  const at = berlinToUtcMs(p.date, p.time);
  if (p.isPizzaOnly) {
    const [h, m] = p.time.split(':').map(Number);
    const t = h * 60 + m;
    const ok = (t >= 12 * 60 && t <= 14 * 60 + 30) || (t >= 18 * 60 && t <= 22 * 60 + 30);
    if (!ok) return 'schedule_pizza_window';
    if (at < now.getTime() + 3600_000) return 'schedule_pizza_lead_time';
    return null;
  }
  if (at < now.getTime() + 24 * 3600_000) return 'schedule_lead_time';
  return null;
}

const PHONE = '0163 6033912';
export const SCHEDULE_MESSAGES: Readonly<Record<ScheduleReject, { de: string; en: string }>> = {
  schedule_lead_time: {
    de: `Catering-Bestellungen benötigen mindestens 24 Stunden Vorlauf. In dringenden Fällen rufen Sie uns an: ${PHONE}.`,
    en: `Catering orders require at least 24 hours advance notice. For urgent cases please call us: ${PHONE}.`,
  },
  schedule_pizza_window: {
    de: 'Pizza-Lieferung ist nur zwischen 12:00-14:30 Uhr und 18:00-22:30 Uhr möglich.',
    en: 'Pizza delivery is only available between 12:00-14:30 and 18:00-22:30.',
  },
  schedule_pizza_lead_time: {
    de: `Die gewählte Zeit ist zu kurzfristig. Bitte mindestens 1 Stunde im Voraus bestellen. Bei Fragen: ${PHONE}.`,
    en: `The selected time is too soon. Please order at least 1 hour in advance. Questions? ${PHONE}.`,
  },
  schedule_weekend_cutoff: {
    de: `Lieferungen für Samstag und Sonntag müssen bis Donnerstag 23:59 Uhr bestellt werden. Für kurzfristige Anfragen: ${PHONE}.`,
    en: `Deliveries for Saturday and Sunday must be ordered by Thursday 11:59 PM. For short-notice requests: ${PHONE}.`,
  },
};
