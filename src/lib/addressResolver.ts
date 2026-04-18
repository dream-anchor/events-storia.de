/**
 * Live-Resolver für Veranstaltungs- und Rechnungsadressen.
 *
 * KEIN Snapshot — die Resolver-Funktionen lesen zur Laufzeit aus Inquiry-Feldern
 * bzw. site_settings.business_data. So gibt es keinen Drift, wenn sich die
 * Geschäftsadresse oder die Firmen-/Custom-Adresse ändert.
 */

import { ResolvedAddress, LocationType } from "@/components/admin/refine/InquiryEditor/types";

export interface BusinessData {
  companyName?: string;
  legalName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

interface InquiryAddressFields {
  location_type: LocationType | null;
  location_name?: string | null;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  company_name?: string | null;
  company_street?: string | null;
  company_postal_code?: string | null;
  company_city?: string | null;
  company_country?: string | null;
  billing_address_different?: boolean | null;
  billing_company_name?: string | null;
  billing_street?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
}

/**
 * Löst die Veranstaltungsadresse (Block 2) zur Laufzeit auf.
 * Wird in PDF und Edge Functions genutzt.
 */
export function resolveLocationAddress(
  inquiry: InquiryAddressFields,
  businessData: BusinessData | null,
): ResolvedAddress {
  const type = inquiry.location_type || 'storia';

  if (type === 'storia') {
    return {
      name: businessData?.companyName || 'Storia Restaurant & Events',
      street: businessData?.address || 'Karlstr. 47a',
      postalCode: businessData?.postalCode || '80333',
      city: businessData?.city || 'München',
      country: businessData?.country || 'Deutschland',
    };
  }

  if (type === 'company') {
    return {
      name: inquiry.company_name || null,
      street: inquiry.company_street || '',
      postalCode: inquiry.company_postal_code || '',
      city: inquiry.company_city || '',
      country: inquiry.company_country || 'Deutschland',
    };
  }

  // custom
  return {
    name: inquiry.location_name || null,
    street: inquiry.location_street || '',
    postalCode: inquiry.location_postal_code || '',
    city: inquiry.location_city || '',
    country: inquiry.location_country || 'Deutschland',
  };
}

/**
 * Löst die Rechnungsadresse (für Angebot/Rechnung-Empfänger) auf.
 * Wenn billing_address_different aktiv → billing_*; sonst company_*.
 * Fallback: contact_name / company_name.
 */
export function resolveBillingAddress(
  inquiry: InquiryAddressFields & { contact_name?: string | null },
): ResolvedAddress {
  if (inquiry.billing_address_different) {
    return {
      name: inquiry.billing_company_name || inquiry.company_name || null,
      street: inquiry.billing_street || '',
      postalCode: inquiry.billing_postal_code || '',
      city: inquiry.billing_city || '',
      country: inquiry.billing_country || 'Deutschland',
    };
  }
  return {
    name: inquiry.company_name || inquiry.contact_name || null,
    street: inquiry.company_street || '',
    postalCode: inquiry.company_postal_code || '',
    city: inquiry.company_city || '',
    country: inquiry.company_country || 'Deutschland',
  };
}

/**
 * Baut Google-Maps-Suchlink für eine Adresse.
 */
export function buildMapsUrl(addr: ResolvedAddress): string {
  const parts = [addr.street, addr.postalCode, addr.city, addr.country]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

/**
 * Formatiert Adresse als einzeiligen String.
 * "Karlstr. 47a, 80333 München"
 */
export function formatAddressOneLine(addr: ResolvedAddress): string {
  const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(' ');
  return [addr.street, cityLine].filter(Boolean).join(', ');
}

/**
 * Formatiert Adresse als mehrzeilig (für PDF-Block).
 */
export function formatAddressLines(addr: ResolvedAddress): string[] {
  const lines: string[] = [];
  if (addr.name) lines.push(addr.name);
  if (addr.street) lines.push(addr.street);
  const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (addr.country && addr.country !== 'Deutschland') lines.push(addr.country);
  return lines;
}
