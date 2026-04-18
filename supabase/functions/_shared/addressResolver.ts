/**
 * Shared Live-Resolver für Edge Functions.
 * Spiegelt src/lib/addressResolver.ts — kein Snapshot, alles zur Laufzeit.
 */

export interface ResolvedAddress {
  name: string | null;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  countryCode: string; // ISO-2 für LexOffice
}

export interface BusinessData {
  companyName?: string;
  legalName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

interface InquiryAddrFields {
  contact_name?: string | null;
  company_name?: string | null;
  location_type?: string | null;
  location_name?: string | null;
  location_street?: string | null;
  location_postal_code?: string | null;
  location_city?: string | null;
  location_country?: string | null;
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

const COUNTRY_CODE_MAP: Record<string, string> = {
  'deutschland': 'DE',
  'germany': 'DE',
  'österreich': 'AT',
  'austria': 'AT',
  'schweiz': 'CH',
  'switzerland': 'CH',
  'frankreich': 'FR',
  'france': 'FR',
  'italien': 'IT',
  'italy': 'IT',
};

function toCountryCode(country: string | null | undefined): string {
  if (!country) return 'DE';
  return COUNTRY_CODE_MAP[country.toLowerCase().trim()] || 'DE';
}

export function resolveLocationAddress(
  inquiry: InquiryAddrFields,
  businessData: BusinessData | null,
): ResolvedAddress {
  const type = inquiry.location_type || 'storia';

  if (type === 'storia') {
    const country = businessData?.country || 'Deutschland';
    return {
      name: businessData?.companyName || 'Storia Restaurant & Events',
      street: businessData?.address || 'Karlstr. 47a',
      postalCode: businessData?.postalCode || '80333',
      city: businessData?.city || 'München',
      country,
      countryCode: toCountryCode(country),
    };
  }

  if (type === 'company') {
    const country = inquiry.company_country || 'Deutschland';
    return {
      name: inquiry.company_name || null,
      street: inquiry.company_street || '',
      postalCode: inquiry.company_postal_code || '',
      city: inquiry.company_city || '',
      country,
      countryCode: toCountryCode(country),
    };
  }

  const country = inquiry.location_country || 'Deutschland';
  return {
    name: inquiry.location_name || null,
    street: inquiry.location_street || '',
    postalCode: inquiry.location_postal_code || '',
    city: inquiry.location_city || '',
    country,
    countryCode: toCountryCode(country),
  };
}

export function resolveBillingAddress(inquiry: InquiryAddrFields): ResolvedAddress {
  if (inquiry.billing_address_different) {
    const country = inquiry.billing_country || 'Deutschland';
    return {
      name: inquiry.billing_company_name || inquiry.company_name || inquiry.contact_name || null,
      street: inquiry.billing_street || '',
      postalCode: inquiry.billing_postal_code || '',
      city: inquiry.billing_city || '',
      country,
      countryCode: toCountryCode(country),
    };
  }
  const country = inquiry.company_country || 'Deutschland';
  return {
    name: inquiry.company_name || inquiry.contact_name || null,
    street: inquiry.company_street || '',
    postalCode: inquiry.company_postal_code || '',
    city: inquiry.company_city || '',
    country,
    countryCode: toCountryCode(country),
  };
}

export function formatLocationOneLine(addr: ResolvedAddress): string {
  const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(' ');
  const parts = [addr.name, addr.street, cityLine].filter(Boolean);
  return parts.join(', ');
}

export async function loadBusinessData(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<BusinessData | null> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'business_data')
      .maybeSingle();
    return (data?.value as BusinessData) || null;
  } catch (e) {
    console.warn('[address-resolver] business_data nicht ladbar:', e);
    return null;
  }
}
