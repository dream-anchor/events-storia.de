/**
 * Zentraler Helper für die Anzeige von Firma/Kontakt in Admin-Listen,
 * Karten, E-Mails, PDFs.
 *
 * Warum es das gibt:
 * Historisch stehen in `company_name` / `contact_name` regelmäßig
 * Platzhalter-Strings wie "null", "n/a", "-", "unbekannt". Ein naiver
 * Truthy-Check (`if (x.company_name)`) rendert diese Platzhalter als
 * echten Text und verursacht dutzende visuelle Bugs (Karten mit "null",
 * E-Mails mit "Hallo null", B2B-Cost-Acceptance für Privatkunden).
 *
 * Regel: NIE direkt auf `x.company_name` prüfen. Immer diesen Helper oder
 * `cleanDisplayText` benutzen.
 */
import { cleanDisplayText } from "@/types/inquiryRecord";

/** Firmenname, wenn echt vorhanden — sonst null. */
export function displayCompanyName(value: unknown): string | null {
  return cleanDisplayText(value);
}

/** Kontaktname, wenn echt vorhanden — sonst null. */
export function displayContactName(value: unknown): string | null {
  return cleanDisplayText(value);
}

/**
 * Primärer Anzeigename für eine Anfrage/Bestellung:
 * Firma > Kontakt > Fallback ("Unbenannte Anfrage").
 */
export function primaryCustomerName(
  company: unknown,
  contact: unknown,
  fallback = "Unbenannte Anfrage",
): string {
  return displayCompanyName(company) ?? displayContactName(contact) ?? fallback;
}

/**
 * Zweizeilige Anzeige "Kontakt · Firma" mit sauberem Handling wenn eines
 * der Felder ein Platzhalter ist.
 */
export function contactWithCompany(company: unknown, contact: unknown): {
  primary: string;
  secondary: string | null;
} {
  const c = displayCompanyName(company);
  const p = displayContactName(contact);
  if (c && p) return { primary: p, secondary: c };
  if (c) return { primary: c, secondary: null };
  if (p) return { primary: p, secondary: null };
  return { primary: "Unbenannte Anfrage", secondary: null };
}

/**
 * True, wenn es sich um eine Privatperson (B2C) handelt — also KEINE
 * echte Firma hinterlegt ist. Ersetzt das fehleranfällige
 * `!inquiry.company_name`, das für den String "null" false liefert.
 */
export function isPrivateCustomer(company: unknown): boolean {
  return displayCompanyName(company) === null;
}