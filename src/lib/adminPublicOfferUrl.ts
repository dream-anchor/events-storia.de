/**
 * Baut Public-Offer-URLs für Admin-Aufrufe ("Public Offer öffnen", "Kunden-Ansicht").
 *
 * WICHTIG — Parität zu OfferSendPreview:
 * Die Vorschau im Editor öffnet `/offer/:id?preview_send=proposal|final` und
 * blendet so dieselben Sections ein, die der Kunde nach Versand sieht. Alle
 * Admin-Buttons, die auf das Public Offer verlinken, MÜSSEN denselben Mode
 * verwenden, damit der Admin keine abweichende Live-Ansicht zu sehen bekommt.
 */
export type AdminPublicOfferPhase = "proposal" | "final";

export function buildAdminPublicOfferUrl(
  inquiryId: string,
  opts: { phase?: AdminPublicOfferPhase; emailDraft?: string | null; absolute?: boolean } = {},
): string {
  const { phase = "final", emailDraft, absolute = false } = opts;
  const base = `/offer/${inquiryId}`;
  const params = new URLSearchParams();
  params.set("preview_send", phase);
  const body = emailDraft?.trim();
  if (body && encodeURIComponent(body).length <= 6000) {
    params.set("preview_body", body);
  }
  // Cache-Bust pro Aufruf, damit Anschreiben/Preise frisch geladen werden.
  params.set("_ts", `${Date.now()}-${inquiryId}`);
  const path = `${base}?${params.toString()}`;
  if (absolute && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}