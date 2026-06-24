/**
 * Parser für `v2_events.source` — mappt technische IDs auf menschenlesbare Labels
 * und extrahiert optional die Package-ID aus `package_inquiry_<uuid>`.
 *
 * Spiegel der Logik in `supabase/functions/receive-event-inquiry/index.ts`.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedInquirySource {
  /** Menschenlesbares Quell-Label (z. B. „Paket-Anfrage (Website)"). */
  label: string;
  /** Falls source = package_inquiry_<uuid>: die extrahierte Package-ID. */
  packageIdFromSource: string | null;
  /** Roher source-Wert (für Debug-Anzeigen). */
  raw: string | null;
}

export function parseInquirySource(
  source: string | null | undefined,
): ParsedInquirySource {
  const raw = source ?? null;
  if (!raw) return { label: "Website", packageIdFromSource: null, raw };

  if (raw.startsWith("package_inquiry_")) {
    const id = raw.slice("package_inquiry_".length);
    return {
      label: "Paket-Anfrage (Website)",
      packageIdFromSource: UUID_RE.test(id) ? id : null,
      raw,
    };
  }

  switch (raw) {
    case "contact_form":
      return { label: "Kontaktformular", packageIdFromSource: null, raw };
    case "manual_entry":
      return { label: "Manuell erfasst", packageIdFromSource: null, raw };
    case "email":
      return { label: "E-Mail", packageIdFromSource: null, raw };
    case "email_forward":
      return { label: "E-Mail-Weiterleitung", packageIdFromSource: null, raw };
    case "email_inbound":
      return { label: "E-Mail (Posteingang)", packageIdFromSource: null, raw };
    case "phone":
      return { label: "Telefonisch", packageIdFromSource: null, raw };
    case "website":
      return { label: "Website", packageIdFromSource: null, raw };
    case "funnel":
      return { label: "Anfrage-Funnel", packageIdFromSource: null, raw };
    default:
      if (raw.startsWith("funnel_")) {
        return { label: "Anfrage-Funnel", packageIdFromSource: null, raw };
      }
      return {
        label: raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " "),
        packageIdFromSource: null,
        raw,
      };
  }
}