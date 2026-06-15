// Draft pricing helpers for the AI catering assistant.
// Used to build the unverbindlicher KI-Draft stored in
// `ai_conversations.metadata.draft`. Deterministic, server-side only.
//
// IMPORTANT: A draft is NEVER a binding offer. The final offer is created
// exclusively by the STORIA team in Maestro (v2_offer_options).

export const ESTIMATE_LOW_FACTOR = 0.9;
export const ESTIMATE_HIGH_FACTOR = 1.15;
export const DRAFT_CURRENCY_DEFAULT = "EUR";
export const DRAFT_DISCLAIMER =
  "Unverbindlicher Entwurf — vorbehaltlich Prüfung und Freigabe durch STORIA.";
export const DRAFT_SCHEMA_VERSION = 1;

export type DraftStatus = "draft" | "submitted" | "adopted" | "discarded";

export type DraftEstimateBasis =
  | "none"
  | "packages"
  | "items"
  | "packages+items"
  | "custom";

export interface DraftPackageSuggestion {
  package_id: string;
  name: string;
  guests: number | null;
  unit_price: number | null;
  subtotal: number | null;
  rationale?: string | null;
}

export interface DraftItemSuggestion {
  menu_item_id: string;
  name: string;
  qty: number | null;
  unit?: string | null;
  unit_price: number | null;
  subtotal: number | null;
  category?: string | null;
}

export interface DraftCustomItem {
  label: string;
  note?: string | null;
}

export interface DraftEstimate {
  currency: string;
  low: number | null;
  high: number | null;
  basis: DraftEstimateBasis;
  disclaimer: string;
}

export interface Draft {
  version: number;
  status: DraftStatus;
  summary: string;
  open_questions: string[];
  suggested_packages: DraftPackageSuggestion[];
  suggested_items: DraftItemSuggestion[];
  custom_items: DraftCustomItem[];
  estimate: DraftEstimate;
  generated_at: string;
  model: string;
}

export function emptyDraft(model = ""): Draft {
  return {
    version: DRAFT_SCHEMA_VERSION,
    status: "draft",
    summary: "",
    open_questions: [],
    suggested_packages: [],
    suggested_items: [],
    custom_items: [],
    estimate: {
      currency: DRAFT_CURRENCY_DEFAULT,
      low: null,
      high: null,
      basis: "none",
      disclaimer: DRAFT_DISCLAIMER,
    },
    generated_at: "",
    model,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve a package unit price for a given guest count.
 * - flat pricing -> package.price
 * - tier pricing -> matching tier from pricing_tiers (jsonb array)
 * Returns null when the price cannot be resolved deterministically.
 * NEVER falls back to price_display (marketing text, not machine-readable).
 */
export function resolvePackagePrice(
  pkg: {
    price: number | string | null;
    pricing_type?: string | null;
    pricing_tiers?: unknown;
    min_guests?: number | null;
    max_guests?: number | null;
  },
  guests: number | null,
): number | null {
  const tiers = Array.isArray(pkg.pricing_tiers)
    ? (pkg.pricing_tiers as Array<Record<string, unknown>>)
    : [];
  if (pkg.pricing_type === "tiered" && tiers.length > 0 && guests != null) {
    const matched = tiers.find((t) => {
      const min = Number(t.min_guests ?? t.from ?? 0);
      const max = Number(t.max_guests ?? t.to ?? Number.MAX_SAFE_INTEGER);
      return guests >= min && guests <= max;
    });
    const p = matched ? Number(matched.price ?? matched.unit_price ?? NaN) : NaN;
    if (Number.isFinite(p)) return round2(p);
    return null;
  }
  const flat = pkg.price == null ? NaN : Number(pkg.price);
  if (Number.isFinite(flat)) return round2(flat);
  return null;
}

export function computeSubtotal(
  unitPrice: number | null,
  qtyOrGuests: number | null,
  perPerson: boolean,
): number | null {
  if (unitPrice == null || !Number.isFinite(unitPrice)) return null;
  if (!perPerson) return round2(unitPrice);
  if (qtyOrGuests == null || !Number.isFinite(qtyOrGuests)) return null;
  return round2(unitPrice * qtyOrGuests);
}

/**
 * Compute the unverbindliche Preisspanne for the draft.
 * low  = total * ESTIMATE_LOW_FACTOR  (0.9)
 * high = total * ESTIMATE_HIGH_FACTOR (1.15)
 */
export function computeEstimate(
  packages: DraftPackageSuggestion[],
  items: DraftItemSuggestion[],
  currency: string = DRAFT_CURRENCY_DEFAULT,
): DraftEstimate {
  const pkgTotal = packages.reduce(
    (acc, p) => acc + (p.subtotal != null && Number.isFinite(p.subtotal) ? p.subtotal : 0),
    0,
  );
  const itemTotal = items.reduce(
    (acc, i) => acc + (i.subtotal != null && Number.isFinite(i.subtotal) ? i.subtotal : 0),
    0,
  );
  const total = pkgTotal + itemTotal;

  let basis: DraftEstimateBasis = "none";
  if (pkgTotal > 0 && itemTotal > 0) basis = "packages+items";
  else if (pkgTotal > 0) basis = "packages";
  else if (itemTotal > 0) basis = "items";

  if (total <= 0) {
    return {
      currency,
      low: null,
      high: null,
      basis,
      disclaimer: DRAFT_DISCLAIMER,
    };
  }

  return {
    currency,
    low: Math.round(total * ESTIMATE_LOW_FACTOR),
    high: Math.round(total * ESTIMATE_HIGH_FACTOR),
    basis,
    disclaimer: DRAFT_DISCLAIMER,
  };
}

/**
 * Validate that an object loaded from ai_conversations.metadata.draft
 * looks like a Draft.
 */
export function isDraftLike(x: unknown): x is Partial<Draft> {
  return (
    typeof x === "object" &&
    x !== null &&
    "version" in (x as Record<string, unknown>)
  );
}
