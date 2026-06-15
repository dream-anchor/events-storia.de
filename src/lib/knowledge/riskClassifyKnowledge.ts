/**
 * Identify content that must NOT be treated as a safe answer source
 * (prices, payment terms, delivery terms, AGB, legal statements, etc.).
 */

export type KnowledgeRisk = "business_rule" | "legal" | null;

const PRICE_PATTERNS: RegExp[] = [
  /\b\d+[.,]?\d*\s*(€|eur|euro)\b/i,
  /\b(eur|€)\s*\d/i,
  /\bab\s+\d/i,
  /\bpreis(e|liste|en)?\b/i,
  /\bkostet\b/i,
  /\bmindestbestell(wert|menge|umsatz)/i,
  /\bliefergebühr|lieferkosten|liefer(pauschale|aufschlag)/i,
  /\banfahrts(pauschale|kosten)\b/i,
  /\banzahlung\s+\d+\s*%/i,
  /\b\d+\s*%\s*(rabatt|discount|anzahlung|deposit|aufschlag|mwst|ust|tax)/i,
  /\bmwst|mehrwertsteuer|ust\.|netto|brutto\b/i,
  /\bkaution\b/i,
  /\bpauschal(e|preis|betrag)\b/i,
];

const LEGAL_PATTERNS: RegExp[] = [
  /\bagb\b/i,
  /\bwiderruf/i,
  /\bhaftung/i,
  /\bgewährleistung/i,
  /\bgarantie/i,
  /\bstorno|stornierung|rücktritt/i,
  /\bdatenschutz/i,
  /\bimpressum/i,
  /\brückerstattung|refund/i,
  /\bzahlungs(frist|ziel|bedingungen)/i,
  /\bvertrag(s|liche)/i,
  /\bverbindlich\b/i,
];

export function classifyKnowledgeRisk(text: string): KnowledgeRisk {
  const t = text || "";
  for (const re of LEGAL_PATTERNS) if (re.test(t)) return "legal";
  for (const re of PRICE_PATTERNS) if (re.test(t)) return "business_rule";
  return null;
}

export function classifyPathRisk(path: string): KnowledgeRisk {
  const p = (path || "").toLowerCase();
  if (
    p.includes("/agb") ||
    p.includes("widerruf") ||
    p.includes("datenschutz") ||
    p.includes("impressum") ||
    p.includes("haftung") ||
    p.includes("lebensmittelhinweise") ||
    p.includes("zahlungsinformationen") ||
    p.includes("cookie")
  ) {
    return "legal";
  }
  if (p.includes("cateringpreise") || p.includes("preise")) {
    return "business_rule";
  }
  return null;
}