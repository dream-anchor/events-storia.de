/**
 * Deep-Link-Parser für /geschenkkoerbe/bestellung
 *
 *   ?korb=klein&wein=bianco-toscana&menge=2
 *   ?pos=klein.bianco-toscana.2,gross.cremant-dry.1      (mehrere Posten)
 *
 * korb = size_key (klein|mittel|gross) oder slug (dolce-vita, sapori-d-italia, gran-selezione)
 * wein = Variantenschlüssel (siehe gift_basket_variants.key); fehlt er, wird die erste verfügbare Variante gewählt.
 * Die URL liefert NUR die Auswahl; Preise und Bestand kommen immer aus dem Katalog (gift_public_catalog).
 * Reine Funktionen ohne Abhängigkeiten (Test: supabase/tests/giftDeeplink_test.ts).
 */

export interface DeepLinkPos {
  korb: string;
  wein: string | null;
  menge: number;
}

export type DeepLinkNote =
  | { kind: "unknown_basket"; korb: string }
  | { kind: "unknown_wine"; korb: string; wein: string }
  | { kind: "sold_out"; korb: string; wein: string }
  | { kind: "capped"; korb: string; wein: string; qty: number };

export const normalizeKey = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function parseQty(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? "1"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parseDeepLink(search: string | URLSearchParams): DeepLinkPos[] {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const out: DeepLinkPos[] = [];

  const pos = params.get("pos");
  if (pos) {
    for (const part of pos.split(",").slice(0, 6)) {
      const [korb, wein, menge] = part.split(".");
      if (korb) out.push({ korb: normalizeKey(korb), wein: wein ? normalizeKey(wein) : null, menge: parseQty(menge) });
    }
  }
  const korb = params.get("korb");
  if (korb) {
    const wein = params.get("wein");
    out.push({ korb: normalizeKey(korb), wein: wein ? normalizeKey(wein) : null, menge: parseQty(params.get("menge")) });
  }
  return out;
}

const left = (available: number | null): number => (available === null ? Number.POSITIVE_INFINITY : available);

export interface ResolvableBasket {
  slug: string;
  size_key: string;
  variants: { id: string; key: string; available: number | null }[]; // null = unbegrenzt
}

/** Löst Deep-Link-Posten gegen den Katalog auf. Ungültiges/Ausverkauftes wird gemeldet, der Rest bleibt erhalten. */
export function resolveDeepLink(
  positions: DeepLinkPos[],
  baskets: ResolvableBasket[],
  maxQtyPerLine: number,
): { lines: { variantId: string; qty: number }[]; notes: DeepLinkNote[] } {
  const lines: { variantId: string; qty: number }[] = [];
  const notes: DeepLinkNote[] = [];

  for (const p of positions) {
    const basket = baskets.find((b) => normalizeKey(b.size_key) === p.korb || normalizeKey(b.slug) === p.korb);
    if (!basket) {
      notes.push({ kind: "unknown_basket", korb: p.korb });
      continue;
    }
    let variant = p.wein ? basket.variants.find((v) => normalizeKey(v.key) === p.wein) : undefined;
    if (p.wein && !variant) {
      notes.push({ kind: "unknown_wine", korb: p.korb, wein: p.wein });
      variant = undefined;
    }
    if (!variant && !p.wein) variant = basket.variants.find((v) => left(v.available) > 0) ?? basket.variants[0];
    if (!variant) continue;
    if (left(variant.available) <= 0) {
      notes.push({ kind: "sold_out", korb: p.korb, wein: variant.key });
      continue;
    }
    const cap = Math.min(maxQtyPerLine, left(variant.available));
    const existing = lines.find((l) => l.variantId === variant!.id);
    const wanted = p.menge + (existing?.qty ?? 0);
    const qty = Math.min(wanted, cap);
    if (qty < wanted) notes.push({ kind: "capped", korb: p.korb, wein: variant.key, qty });
    if (existing) existing.qty = qty;
    else lines.push({ variantId: variant.id, qty });
  }
  return { lines, notes };
}
