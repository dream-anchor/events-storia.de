import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTestMode } from "@/contexts/TestModeContext";
import { isTestEventRow } from "@/lib/testRecords";
import { LOSS_REASON_LABELS, type ConversionRange } from "@/hooks/useConversionData";

// =====================================================================
// Diagnose-Engine: Warum wurde eine Anfrage NICHT zum Deal?
//
// Pro verlorener oder festhängender Anfrage wird EIN Primärbefund
// abgeleitet (rein deterministisch, nachvollziehbar). Die Einzelbefunde
// rollen zu "Lecks" hoch, sortiert nach entgangenem Umsatz.
//
// Entgangener Umsatz = echter Angebotswert (gesichert) bzw.
// Gästezahl × Ø-Bestellwert (geschätzt) — getrennt ausgewiesen.
// =====================================================================

export type FindingKey =
  | "never_answered"
  | "too_slow"
  | "offer_unopened"
  | "went_cold"
  | "price"
  | "date"
  | "plan_cancelled"
  | "not_qualified"
  | "other";

/** Statischer Befund-Katalog: Titel + feste Handlungsempfehlung. */
export const FINDING_META: Record<
  FindingKey,
  { title: string; recommendation: string }
> = {
  never_answered: {
    title: "Nie beantwortet",
    recommendation:
      "Jede Anfrage mit fester Frist (< 24 h) einem Verantwortlichen zuweisen. WhatsApp-Alert nutzen — keine Anfrage darf durchrutschen.",
  },
  too_slow: {
    title: "Reaktion zu langsam",
    recommendation:
      "Erstreaktion < 24 h als Ziel setzen. Angebotsvorlagen je Anlass vorbereiten, damit das Angebot schneller rausgeht.",
  },
  offer_unopened: {
    title: "Angebot nie geöffnet",
    recommendation:
      "Bei „nicht geöffnet nach 48 h“ telefonisch oder per WhatsApp nachhaken. Mail-Zustellung & Bounces im Resend-Log prüfen.",
  },
  went_cold: {
    title: "Interesse verpufft",
    recommendation:
      "Festen Nachfass-Rhythmus etablieren: an Tag 2 und Tag 5 nach Öffnung freundlich erinnern.",
  },
  price: {
    title: "Preis als Hürde",
    recommendation:
      "Immer zwei Preisstufen ins Angebot. Für große Gruppen ein Paket-/Staffelangebot testen.",
  },
  date: {
    title: "Wunschtermin nicht frei",
    recommendation:
      "Bei Terminkonflikt sofort 1–2 Alternativtermine aktiv vorschlagen, statt nur abzusagen.",
  },
  plan_cancelled: {
    title: "Anlass abgesagt",
    recommendation: "Kundenseitig abgesagt — kein Handlungsbedarf.",
  },
  not_qualified: {
    title: "Unpassend / Spam",
    recommendation: "Kein echter Lead — kein Handlungsbedarf.",
  },
  other: {
    title: "Sonstige Gründe",
    recommendation:
      "Verlust-Grund nachtragen, damit das Muster auswertbar wird.",
  },
};

/** Befunde, die KEIN beeinflussbares Conversion-Leck sind (kein Umsatzverlust). */
const NON_ACTIONABLE: ReadonlySet<FindingKey> = new Set([
  "not_qualified",
  "plan_cancelled",
]);

const STAGE_RANK: Record<string, number> = {
  inquiry: 0,
  offer_draft: 1,
  offer_sent: 2,
  offer_chosen: 3,
  paid: 4,
  completed: 5,
};
const TERMINAL_LOST = new Set([
  "offer_declined",
  "cancelled",
  "no_response",
  "payment_failed",
]);

// Schwellen — "fix als Untergrenze + relativ".
const SLOW_FLOOR_DAYS = 2; // unter 2 Werktagen nie "langsam"
const SLOW_REL_MARGIN = 1; // ein Werktag über dem eigenen Median
const SLOW_ABSOLUTE = 3; // ohne Median-Vergleich: > 3 Werktage = langsam
const STALL_NO_OFFER_DAYS = 3; // offene Anfrage ohne Angebot gilt ab hier als hängend
const STALL_UNOPENED_DAYS = 2; // Angebot raus, nicht geöffnet
const STALL_COLD_DAYS = 3; // Angebot geöffnet, keine Buchung

export interface InquiryDiagnosis {
  id: string;
  label: string;
  occasion: string | null;
  guestCount: number | null;
  status: string;
  isOpen: boolean; // true = noch zu retten, false = endgültig verloren
  ageDays: number;
  finding: FindingKey;
  findingText: string;
  valueCents: number;
  valueEstimated: boolean;
  hasLossReason: boolean;
  createdAt: string;
}

export interface Leak {
  key: FindingKey;
  title: string;
  recommendation: string;
  count: number;
  openCount: number;
  securedCents: number;
  estimatedCents: number;
  totalCents: number;
  detail: string;
}

export interface SegmentPattern {
  key: string;
  label: string;
  inquiries: number;
  booked: number;
  bookedRate: number;
  belowAvg: boolean;
}

export interface DiagnosticsData {
  summary: {
    inquiries: number;
    booked: number;
    bookedRate: number;
    lostCount: number;
    openStalledCount: number;
    lostSecuredCents: number;
    lostEstimatedCents: number;
    avgDaysToOffer: number | null;
    medianDaysToOffer: number | null;
    avgOrderPerGuestCents: number | null;
  };
  leaks: Leak[];
  inquiries: InquiryDiagnosis[];
  segments: {
    byOccasion: SegmentPattern[];
    byGuestBucket: SegmentPattern[];
  };
}

interface DiagRow {
  id: string;
  status: string;
  source: string | null;
  assigned_to: string | null;
  amount_total: number | null;
  guest_count: number | null;
  occasion: string | null;
  created_at: string;
  status_changed_at: string | null;
  offer_sent_at: string | null;
  offer_first_viewed_at: string | null;
  offer_view_count: number | null;
  loss_reason: string | null;
  is_test: boolean | null;
  v2_customers?: { name: string | null; company: string | null; email: string | null } | null;
}

export const OCCASION_LABELS: Record<string, string> = {
  firmenfeier: "Firmenfeier",
  hochzeit: "Hochzeit",
  geburtstag: "Geburtstag",
  weihnachtsfeier: "Weihnachtsfeier",
  taufe: "Taufe",
  kommunion: "Kommunion/Konfirmation",
  jubilaeum: "Jubiläum",
  trauerfeier: "Trauerfeier",
  sonstiges: "Sonstiges",
};

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined
    ? s[base] + rest * (s[base + 1] - s[base])
    : s[base];
}

/** Werktage zwischen zwei ISO-Zeitpunkten (Wochenenden ausgenommen). */
function businessDaysBetween(fromIso: string, toIso: string): number {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  if (!(end > start)) return 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  let days = 0;
  while (cur < last) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days += 1;
  }
  return days;
}

function guestBucket(n: number | null): { key: string; label: string } | null {
  if (n == null || n <= 0) return null;
  if (n <= 10) return { key: "g_0_10", label: "bis 10 Gäste" };
  if (n <= 25) return { key: "g_11_25", label: "11–25 Gäste" };
  if (n <= 50) return { key: "g_26_50", label: "26–50 Gäste" };
  if (n <= 100) return { key: "g_51_100", label: "51–100 Gäste" };
  return { key: "g_100p", label: "über 100 Gäste" };
}

function occasionLabel(o: string | null): string {
  if (!o) return "Ohne Anlass";
  return OCCASION_LABELS[o] || o.charAt(0).toUpperCase() + o.slice(1);
}

function labelOf(r: DiagRow): string {
  return (
    r.v2_customers?.company?.trim() ||
    r.v2_customers?.name?.trim() ||
    "Unbenannte Anfrage"
  );
}

function isSlow(days: number, med: number | null): boolean {
  if (days <= SLOW_FLOOR_DAYS) return false;
  if (med == null) return days > SLOW_ABSOLUTE;
  return days >= med + SLOW_REL_MARGIN;
}

export function useInquiryDiagnostics(range: ConversionRange) {
  const { showTestData } = useTestMode();
  return useQuery<DiagnosticsData>({
    queryKey: ["inquiry-diagnostics", range.from, range.to, showTestData],
    refetchInterval: 120_000,
    retry: 1,
    queryFn: async () => {
      let q = supabase
        .from("v2_events")
        .select(
          "id, status, source, assigned_to, amount_total, guest_count, occasion, created_at, status_changed_at, offer_sent_at, offer_first_viewed_at, offer_view_count, loss_reason, is_test, v2_customers ( name, company, email )"
        );
      if (range.from) q = q.gte("created_at", range.from);
      if (range.to) q = q.lt("created_at", range.to);

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as unknown as DiagRow[];
      if (!showTestData) rows = rows.filter((r) => !isTestEventRow(r));

      const now = new Date().toISOString();
      const rankOf = (s: string) => STAGE_RANK[s] ?? -1;

      // --- Kennzahlen für Schwellen & Schätzung -----------------------
      const daysToOfferAll = rows
        .filter((r) => r.offer_sent_at)
        .map((r) => businessDaysBetween(r.created_at, r.offer_sent_at!))
        .filter((d) => d >= 0 && d < 365);
      const medianDaysToOffer = median(daysToOfferAll);
      const avgDaysToOffer = daysToOfferAll.length
        ? Math.round(
            (daysToOfferAll.reduce((s, d) => s + d, 0) / daysToOfferAll.length) * 10
          ) / 10
        : null;

      // Ø-Bestellwert je Gast (aus bezahlten Aufträgen, Median pro Kopf).
      const perGuest = rows
        .filter(
          (r) => rankOf(r.status) >= 4 && (r.guest_count || 0) > 0 && (r.amount_total || 0) > 0
        )
        .map((r) => (r.amount_total as number) / (r.guest_count as number));
      const avgOrderPerGuestCents =
        perGuest.length > 0 ? Math.round((median(perGuest) as number) * 100) : null;

      // 75-%-Quantil des Angebotswerts je Gäste-Bucket (für Preis-Befund).
      const bucketValues = new Map<string, number[]>();
      rows.forEach((r) => {
        const b = guestBucket(r.guest_count);
        if (!b || !(r.amount_total && r.amount_total > 0)) return;
        if (!bucketValues.has(b.key)) bucketValues.set(b.key, []);
        bucketValues.get(b.key)!.push(r.amount_total);
      });
      const bucketP75 = new Map<string, number>();
      bucketValues.forEach((vals, key) => {
        if (vals.length >= 4) bucketP75.set(key, quantile(vals, 0.75) as number);
      });
      const isExpensiveForBucket = (r: DiagRow): boolean => {
        const b = guestBucket(r.guest_count);
        if (!b || !(r.amount_total && r.amount_total > 0)) return false;
        const p75 = bucketP75.get(b.key);
        return p75 != null && r.amount_total >= p75;
      };

      // --- Wert einer Anfrage (gesichert vs. geschätzt) ---------------
      const valueOf = (r: DiagRow): { cents: number; estimated: boolean } => {
        if (r.amount_total && r.amount_total > 0) {
          return { cents: Math.round(r.amount_total * 100), estimated: false };
        }
        if (r.guest_count && r.guest_count > 0 && avgOrderPerGuestCents) {
          return { cents: r.guest_count * avgOrderPerGuestCents, estimated: true };
        }
        return { cents: 0, estimated: false };
      };

      // --- Kandidaten: verloren ODER offen & hängend ------------------
      const isStalledOpen = (r: DiagRow): boolean => {
        if (TERMINAL_LOST.has(r.status)) return false;
        if (rankOf(r.status) >= 3) return false; // schon gebucht
        if (!r.offer_sent_at) {
          return businessDaysBetween(r.created_at, now) > STALL_NO_OFFER_DAYS;
        }
        if (!r.offer_first_viewed_at) {
          return businessDaysBetween(r.offer_sent_at, now) > STALL_UNOPENED_DAYS;
        }
        return businessDaysBetween(r.offer_first_viewed_at, now) > STALL_COLD_DAYS;
      };

      const classify = (r: DiagRow): FindingKey => {
        const reason = r.loss_reason;
        // Vom Betreiber gesetzte, eindeutige Gründe haben Vorrang.
        if (reason === "not_qualified") return "not_qualified";
        if (reason === "plan_cancelled") return "plan_cancelled";
        if (reason === "date_unavailable") return "date";
        if (reason === "too_expensive") return "price";

        const daysToOffer = r.offer_sent_at
          ? businessDaysBetween(r.created_at, r.offer_sent_at)
          : null;
        const opened = !!r.offer_first_viewed_at || (r.offer_view_count || 0) > 0;

        // Verhaltensbasierte Befunde.
        let key: FindingKey;
        if (!r.offer_sent_at && rankOf(r.status) < 2) key = "never_answered";
        else if (r.offer_sent_at && !opened) key = "offer_unopened";
        else if (daysToOffer != null && isSlow(daysToOffer, medianDaysToOffer))
          key = "too_slow";
        else if (opened) key = "went_cold";
        else key = "other";

        // Preis-Override: geöffnet/unklar, aber im oberen Preisquartil.
        if ((key === "went_cold" || key === "other") && isExpensiveForBucket(r)) {
          return "price";
        }
        return key;
      };

      const describe = (r: DiagRow, finding: FindingKey): string => {
        const daysToOffer = r.offer_sent_at
          ? businessDaysBetween(r.created_at, r.offer_sent_at)
          : null;
        const views = r.offer_view_count || 0;
        switch (finding) {
          case "never_answered":
            return "Kein Angebot rausgegangen → Anfrage durchgerutscht";
          case "too_slow":
            return `Angebot erst nach ${daysToOffer} Werktagen → zu spät`;
          case "offer_unopened":
            return "Angebot verschickt, nie geöffnet → Zustellung prüfen";
          case "went_cold":
            return views > 1
              ? `${views}× geöffnet, dann Funkstille → Nachfass fehlte`
              : "Geöffnet, keine Buchung → Nachfass fehlte";
          case "price":
            return r.loss_reason === "too_expensive"
              ? "Grund: zu teuer"
              : "Hoher Angebotswert für die Gruppengröße → vermutlich Preis";
          case "date":
            return "Wunschtermin nicht frei";
          case "plan_cancelled":
            return "Anlass kundenseitig abgesagt";
          case "not_qualified":
            return "Kein echter Lead";
          default:
            return r.loss_reason
              ? LOSS_REASON_LABELS[r.loss_reason] || "Sonstiger Grund"
              : "Grund offen";
        }
      };

      const candidates = rows.filter(
        (r) => TERMINAL_LOST.has(r.status) || isStalledOpen(r)
      );

      const diagnoses: InquiryDiagnosis[] = candidates
        .map((r) => {
          const finding = classify(r);
          const v = valueOf(r);
          const countsAsLoss = !NON_ACTIONABLE.has(finding);
          return {
            id: r.id,
            label: labelOf(r),
            occasion: r.occasion,
            guestCount: r.guest_count,
            status: r.status,
            isOpen: !TERMINAL_LOST.has(r.status),
            ageDays: Math.round(businessDaysBetween(r.created_at, now)),
            finding,
            findingText: describe(r, finding),
            valueCents: countsAsLoss ? v.cents : 0,
            valueEstimated: countsAsLoss ? v.estimated : false,
            hasLossReason: !!r.loss_reason,
            createdAt: r.created_at,
          };
        })
        .sort((a, b) => b.valueCents - a.valueCents || b.createdAt.localeCompare(a.createdAt));

      // --- Roll-up zu Lecks (ohne nicht-beeinflussbare Befunde) -------
      const leakMap = new Map<FindingKey, Leak>();
      diagnoses.forEach((d) => {
        if (NON_ACTIONABLE.has(d.finding)) return;
        if (!leakMap.has(d.finding)) {
          leakMap.set(d.finding, {
            key: d.finding,
            title: FINDING_META[d.finding].title,
            recommendation: FINDING_META[d.finding].recommendation,
            count: 0,
            openCount: 0,
            securedCents: 0,
            estimatedCents: 0,
            totalCents: 0,
            detail: "",
          });
        }
        const leak = leakMap.get(d.finding)!;
        leak.count += 1;
        if (d.isOpen) leak.openCount += 1;
        if (d.valueEstimated) leak.estimatedCents += d.valueCents;
        else leak.securedCents += d.valueCents;
        leak.totalCents += d.valueCents;
      });

      // Dynamische Detailtexte je Leck.
      const slowDays = candidates
        .filter((r) => classify(r) === "too_slow" && r.offer_sent_at)
        .map((r) => businessDaysBetween(r.created_at, r.offer_sent_at!));
      const offersSent = rows.filter(
        (r) => r.offer_sent_at != null || rankOf(r.status) >= 2
      ).length;
      const unopened = rows.filter(
        (r) =>
          (r.offer_sent_at != null || rankOf(r.status) >= 2) &&
          !r.offer_first_viewed_at &&
          rankOf(r.status) < 3
      ).length;

      const leaks = Array.from(leakMap.values())
        .map((leak) => {
          let detail = "";
          if (leak.key === "too_slow" && slowDays.length) {
            const avgSlow =
              Math.round((slowDays.reduce((s, d) => s + d, 0) / slowDays.length) * 10) / 10;
            detail = `Im Schnitt ${avgSlow} Werktage bis zum Angebot${
              medianDaysToOffer != null ? ` (dein Median: ${medianDaysToOffer})` : ""
            }. Wer zuerst antwortet, gewinnt meist.`;
          } else if (leak.key === "offer_unopened") {
            detail = offersSent
              ? `${pct(unopened, offersSent)} % deiner verschickten Angebote wurden nie geöffnet — fast immer ein Zustellproblem.`
              : "Verschickte Angebote werden nicht geöffnet — Zustellung prüfen.";
          } else if (leak.key === "never_answered") {
            detail =
              "Diese Anfragen haben nie ein Angebot bekommen — ein interner Prozess-Leak, kein Kundenproblem.";
          } else if (leak.key === "went_cold") {
            detail =
              "Interesse war da, ging dann verloren — meist fehlt ein konsequenter Nachfass.";
          } else if (leak.key === "price") {
            detail =
              "Bei diesen Anfragen war der Preis vermutlich der Knackpunkt — oft bei großen Gruppen.";
          } else if (leak.key === "date") {
            detail = "Wunschtermin war nicht verfügbar.";
          } else if (leak.key === "other") {
            detail = "Verlust-Gründe nachtragen, um das Muster zu schärfen.";
          }
          return { ...leak, detail };
        })
        .sort((a, b) => b.totalCents - a.totalCents || b.count - a.count);

      // --- Segment-Muster (über alle Anfragen) ------------------------
      const buildSegments = (
        keyFn: (r: DiagRow) => { key: string; label: string } | null
      ): SegmentPattern[] => {
        const groups = new Map<string, { label: string; rows: DiagRow[] }>();
        rows.forEach((r) => {
          const g = keyFn(r);
          if (!g) return;
          if (!groups.has(g.key)) groups.set(g.key, { label: g.label, rows: [] });
          groups.get(g.key)!.rows.push(r);
        });
        const overallBookedRate = pct(
          rows.filter((r) => rankOf(r.status) >= 3).length,
          rows.length
        );
        return Array.from(groups.entries())
          .map(([key, grp]) => {
            const booked = grp.rows.filter((r) => rankOf(r.status) >= 3).length;
            const bookedRate = pct(booked, grp.rows.length);
            return {
              key,
              label: grp.label,
              inquiries: grp.rows.length,
              booked,
              bookedRate,
              belowAvg: grp.rows.length >= 3 && bookedRate < overallBookedRate,
            };
          })
          .filter((s) => s.inquiries >= 2)
          .sort((a, b) => a.bookedRate - b.bookedRate);
      };

      const lostCount = diagnoses.filter((d) => !d.isOpen && !NON_ACTIONABLE.has(d.finding)).length;
      const openStalledCount = diagnoses.filter((d) => d.isOpen).length;
      const lostSecuredCents = diagnoses.reduce(
        (s, d) => s + (d.valueEstimated ? 0 : d.valueCents),
        0
      );
      const lostEstimatedCents = diagnoses.reduce(
        (s, d) => s + (d.valueEstimated ? d.valueCents : 0),
        0
      );
      const booked = rows.filter((r) => rankOf(r.status) >= 3).length;

      return {
        summary: {
          inquiries: rows.length,
          booked,
          bookedRate: pct(booked, rows.length),
          lostCount,
          openStalledCount,
          lostSecuredCents,
          lostEstimatedCents,
          avgDaysToOffer,
          medianDaysToOffer,
          avgOrderPerGuestCents,
        },
        leaks,
        inquiries: diagnoses,
        segments: {
          byOccasion: buildSegments((r) =>
            r.occasion ? { key: r.occasion, label: occasionLabel(r.occasion) } : null
          ),
          byGuestBucket: buildSegments((r) => guestBucket(r.guest_count)),
        },
      };
    },
  });
}
