/**
 * Geschenkkorb-Shop: reine Rechenlogik (keine Deno-/Node-/Browser-Abhängigkeit).
 *
 * Einzige Quelle der Wahrheit für Liefergebühr (Taxitarif), Steuer-Aufteilung und Terminregeln.
 * Wird von den Edge Functions (gift-delivery-quote, create-gift-order, Webhook) UND vom Shop-Frontend
 * (src/lib/gift/pricing.ts re-exportiert diese Datei) benutzt. Der Server rechnet immer neu; das Frontend
 * zeigt nur an.
 *
 * Beträge: Cent (integer). Zeiten: Europa/Berlin.
 */

// ── Tarif ───────────────────────────────────────────────────────────────────
export interface TariffTier {
  from_km: number;
  per_km_cents: number;
}

export interface DeliveryTariff {
  tiers: TariffTier[];
  min_fee_cents: number;
  round_up_to_cents: number;
}

/** Fallback-Konstanten (Entscheidung Antoine 20.11.2026); maßgeblich ist gift_settings in der DB. */
export const DEFAULT_DELIVERY_TARIFF: DeliveryTariff = {
  tiers: [
    { from_km: 0, per_km_cents: 270 }, // erste 7 km
    { from_km: 7, per_km_cents: 250 }, // nur Mehr-km
  ],
  min_fee_cents: 590,
  round_up_to_cents: 100,
};

export function parseTariff(raw: {
  tariff_tiers: unknown;
  min_fee_cents: unknown;
  round_up_to_cents: unknown;
}): DeliveryTariff {
  const tiers = Array.isArray(raw.tariff_tiers) ? raw.tariff_tiers : [];
  const parsed: TariffTier[] = tiers
    .map((t) => ({ from_km: Number((t as TariffTier).from_km), per_km_cents: Number((t as TariffTier).per_km_cents) }))
    .filter((t) => Number.isFinite(t.from_km) && t.from_km >= 0 && Number.isFinite(t.per_km_cents) && t.per_km_cents >= 0)
    .sort((a, b) => a.from_km - b.from_km);
  const min = Number(raw.min_fee_cents);
  const round = Number(raw.round_up_to_cents);
  if (parsed.length === 0 || parsed[0].from_km !== 0 || !Number.isFinite(min) || min < 0 || !Number.isFinite(round) || round < 1) {
    throw new Error("invalid_tariff");
  }
  return { tiers: parsed, min_fee_cents: min, round_up_to_cents: round };
}

/**
 * Liefergebühr für die EINFACHE Straßenstrecke (kein Rückweg), anteilig je Staffel:
 * erste 7 km zu 2,70 EUR/km, jeder weitere km zu 2,50 EUR/km; Minimum 5,90 EUR; auf volle Euro AUFGERUNDET.
 * Beispiele: 2 km -> 6 EUR, 7 km -> 19 EUR, 10 km -> 27 EUR.
 */
export function computeDeliveryFeeCents(distanceKm: number, tariff: DeliveryTariff = DEFAULT_DELIVERY_TARIFF): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error("invalid_distance");
  const tiers = [...tariff.tiers].sort((a, b) => a.from_km - b.from_km);
  let fee = 0;
  for (let i = 0; i < tiers.length; i++) {
    const from = tiers[i].from_km;
    const to = i + 1 < tiers.length ? tiers[i + 1].from_km : Infinity;
    const kmInTier = Math.max(0, Math.min(distanceKm, to) - from);
    fee += kmInTier * tiers[i].per_km_cents;
  }
  fee = Math.max(fee, tariff.min_fee_cents);
  // 1e-6-Toleranz gegen Gleitkomma-Artefakte (z. B. 7 km * 270 = 1890.0000000000002)
  return Math.ceil(fee / tariff.round_up_to_cents - 1e-6) * tariff.round_up_to_cents;
}

/** Luftlinie in km (Haversine) – nur für die Plausibilitätsprüfung vor dem Routing-Aufruf. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Steuer ──────────────────────────────────────────────────────────────────
/** [{"rate":7,"share_bp":6000},{"rate":19,"share_bp":4000}] – Summe share_bp = 10000 (vom Steuerberater). */
export interface VatShare {
  rate: number;
  share_bp: number;
}

export function isValidVatSplit(v: unknown): v is VatShare[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  let sum = 0;
  for (const s of v) {
    const rate = Number((s as VatShare)?.rate);
    const bp = Number((s as VatShare)?.share_bp);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isInteger(bp) || bp < 0) return false;
    sum += bp;
  }
  return sum === 10000;
}

/** Brutto in Anteile je Steuersatz zerlegen; der letzte Anteil bekommt den Rundungsrest (Summe stimmt immer). */
export function splitGrossByVat(grossCents: number, split: VatShare[]): { rate: number; gross_cents: number }[] {
  const out: { rate: number; gross_cents: number }[] = [];
  let used = 0;
  split.forEach((s, i) => {
    const part = i === split.length - 1 ? grossCents - used : Math.round((grossCents * s.share_bp) / 10000);
    used += part;
    out.push({ rate: s.rate, gross_cents: part });
  });
  return out;
}

export interface VatBreakdownLine {
  rate: number;
  gross_cents: number;
  net_cents: number;
  vat_cents: number;
}

/** Steuer-Aufschlüsselung der Bestellung (Brutto je Satz, Netto und MwSt.). Liefergebühr zählt mit eigenem Satz. */
export function computeVatBreakdown(
  items: { unit_price_cents: number; qty: number; vat_split: VatShare[] | null }[],
  delivery: { fee_cents: number; vat_rate: number } | null,
): VatBreakdownLine[] | null {
  const byRate = new Map<number, number>();
  for (const it of items) {
    if (!it.vat_split || !isValidVatSplit(it.vat_split)) return null; // Aufteilung fehlt -> keine Rechnung automatisch
    for (const part of splitGrossByVat(it.unit_price_cents * it.qty, it.vat_split)) {
      byRate.set(part.rate, (byRate.get(part.rate) ?? 0) + part.gross_cents);
    }
  }
  if (delivery && delivery.fee_cents > 0) {
    byRate.set(delivery.vat_rate, (byRate.get(delivery.vat_rate) ?? 0) + delivery.fee_cents);
  }
  return [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, gross]) => {
      const net = Math.round(gross / (1 + rate / 100));
      return { rate, gross_cents: gross, net_cents: net, vat_cents: gross - net };
    });
}

// ── Termine ─────────────────────────────────────────────────────────────────
export type Handover = "pickup" | "delivery";

export interface PickupHours {
  [weekday: string]: { open: string; close: string } | undefined; // "0" = Sonntag … "6" = Samstag
}

export interface DeliveryWindow {
  key: string;
  label_de: string;
  label_en: string;
}

export interface ScheduleSettings {
  pickup_hours: PickupHours;
  pickup_lead_minutes: number;
  delivery_lead_days: number;
  delivery_windows: DeliveryWindow[];
}

export interface BlackoutDate {
  date: string; // YYYY-MM-DD
  handover: "pickup" | "delivery" | "both";
}

const BERLIN = "Europe/Berlin";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function berlinParts(now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Berliner Wandzeit (YYYY-MM-DD, HH:MM) -> UTC-Zeitpunkt (berücksichtigt Sommer-/Winterzeit). */
export function berlinToUtc(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  // Abweichung der Berliner Wandzeit vom Raten bestimmen und korrigieren (zweimal wegen DST-Rand)
  let result = guess;
  for (let i = 0; i < 2; i++) {
    const p = berlinParts(result);
    const wantMin = h * 60 + m;
    const diff = (new Date(`${p.date}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 60000 + (p.minutes - wantMin);
    if (diff === 0) break;
    result = new Date(result.getTime() - diff * 60000);
  }
  return result;
}

export type ScheduleError =
  | "invalid_date"
  | "invalid_time"
  | "date_in_past"
  | "blackout"
  | "closed"
  | "too_early"
  | "lead_time"
  | "invalid_window";

export interface ScheduleCheck {
  ok: boolean;
  error?: ScheduleError;
  /** Abholung: Ende der Reservierung bei "vor Ort zahlen" = Ladenschluss des Abholtags (UTC). */
  closing_at?: Date;
}

/** Früheste wählbare Übergabe: Abholung "sofort" (heute, ab Jetzt + Packzeit) bzw. Lieferung ab Folgetag. */
export function earliestDate(handover: Handover, now: Date, s: ScheduleSettings): string {
  const today = berlinParts(now).date;
  return handover === "pickup" ? today : addDays(today, s.delivery_lead_days);
}

export function isBlackout(date: string, handover: Handover, blackout: BlackoutDate[]): boolean {
  return blackout.some((b) => b.date === date && (b.handover === "both" || b.handover === handover));
}

/**
 * Prüft Datum + Zeit gegen die Regeln:
 *  - Abholung: Öffnungszeiten laut pickup_hours; heute nur ab Jetzt + Packzeit; Sperrtage.
 *  - Lieferung: frühestens heute + delivery_lead_days; time = Key eines Lieferfensters; Sperrtage.
 */
export function checkSchedule(
  handover: Handover,
  date: string,
  time: string,
  now: Date,
  s: ScheduleSettings,
  blackout: BlackoutDate[],
): ScheduleCheck {
  if (!isIsoDate(date)) return { ok: false, error: "invalid_date" };
  const nowB = berlinParts(now);
  if (date < nowB.date) return { ok: false, error: "date_in_past" };
  if (isBlackout(date, handover, blackout)) return { ok: false, error: "blackout" };

  if (handover === "delivery") {
    if (date < earliestDate("delivery", now, s)) return { ok: false, error: "lead_time" };
    if (!s.delivery_windows.some((w) => w.key === time)) return { ok: false, error: "invalid_window" };
    return { ok: true };
  }

  if (!TIME_RE.test(time)) return { ok: false, error: "invalid_time" };
  const hours = s.pickup_hours[String(weekdayOf(date))];
  if (!hours) return { ok: false, error: "closed" };
  const t = toMinutes(time);
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  // Öffnungszeit über Mitternacht (close <= open, z. B. 09:00-01:00): Zeiten ab Öffnung gehören zum Kalendertag,
  // Zeiten bis Ladenschluss (z. B. 00:30) zur Nacht NACH dem gewählten Geschäftstag.
  const overnight = close <= open;
  const slotDate = overnight && t < open ? addDays(date, 1) : date;
  if (overnight ? !(t >= open || t <= close) : !(t >= open && t <= close)) return { ok: false, error: "closed" };
  const slotAt = berlinToUtc(slotDate, time);
  if (slotAt.getTime() < now.getTime() + s.pickup_lead_minutes * 60_000) {
    return { ok: false, error: date === nowB.date ? "too_early" : "closed" };
  }
  return { ok: true, closing_at: berlinToUtc(overnight ? addDays(date, 1) : date, hours.close) };
}

/** Abholzeiten-Raster (15 Min) für einen Tag; leer, wenn geschlossen/Sperrtag/zu spät. */
export function pickupSlots(date: string, now: Date, s: ScheduleSettings, blackout: BlackoutDate[], stepMinutes = 15): string[] {
  const out: string[] = [];
  const hours = s.pickup_hours[String(weekdayOf(date))];
  if (!isIsoDate(date) || !hours) return out;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const end = close <= open ? close + 24 * 60 : close; // über Mitternacht: bis Ladenschluss am Folgetag
  for (let t = open; t <= end; t += stepMinutes) {
    const m = t % (24 * 60);
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (checkSchedule("pickup", date, hhmm, now, s, blackout).ok) out.push(hhmm);
  }
  return out;
}

// ── Bestellsumme ────────────────────────────────────────────────────────────
export const MAX_QTY_PER_LINE = 10;
export const MAX_QTY_PER_ORDER = 20;

export function formatEuro(cents: number, locale: "de" | "en" = "de"): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
}
