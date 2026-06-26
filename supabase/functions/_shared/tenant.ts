/**
 * Shared Tenant-Helper (Phase 4a) — Mandanten-Auflösung & -Konfiguration.
 *
 * REIN ADDITIV: Diese Datei wird von bestehenden Functions noch nicht benutzt.
 * Jeder Resolver fällt auf den Default-Tenant (Storia) zurück → solange nur
 * Storia existiert, liefert alles identische Werte wie der heutige Hardcode.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Fester Default-Tenant (siehe Migration 20260625120000). */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface TenantConfig {
  tenantId: string;
  slug: string | null;
  name: string;
  legalName: string | null;
  brandName: string;
  /** Kundenseitiger Absender-Anzeigename (z.B. "STORIA Events"), NICHT brandName. */
  emailFromName: string;
  fromEmail: string;
  replyToEmail: string;
  contactEmail: string | null;
  website: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  vatId: string | null;
  logoUrl: string | null;
  stripeAccountId: string | null;
}

/**
 * Storia-Fallback — entspricht 1:1 den heute hartcodierten Werten.
 * Wird verwendet, wenn kein Tenant gefunden wird oder Felder leer sind.
 */
const STORIA_FALLBACK: TenantConfig = {
  tenantId: DEFAULT_TENANT_ID,
  slug: 'storia',
  name: 'STORIA Catering & Events',
  legalName: 'Speranza GmbH',
  brandName: 'StoriaMaestro',
  emailFromName: 'STORIA Events',
  fromEmail: 'info@events-storia.de',
  replyToEmail: 'info@events-storia.de',
  contactEmail: 'info@events-storia.de',
  website: 'https://events-storia.de',
  phone: '+49 89 51519696',
  addressStreet: 'Karlstraße 47a',
  addressZip: '80333',
  addressCity: 'München',
  vatId: null,
  logoUrl: null,
  stripeAccountId: null,
};

/**
 * Lädt die Mandanten-Konfiguration. Fehlende Felder fallen auf Storia-Werte
 * zurück (NON-BREAKING). Bei unbekanntem Tenant → komplettes Storia-Fallback.
 */
export async function getTenantConfig(
  client: SupabaseClient,
  tenantId: string | null | undefined,
): Promise<TenantConfig> {
  const id = tenantId || DEFAULT_TENANT_ID;
  const { data } = await client
    .from('tenants')
    .select(
      'id, slug, name, legal_name, brand_name, email_from_name, from_email, reply_to_email, contact_email, website, phone, address_street, address_zip, address_city, vat_id, logo_url, stripe_account_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) return { ...STORIA_FALLBACK, tenantId: id };

  return {
    tenantId: data.id,
    slug: data.slug ?? STORIA_FALLBACK.slug,
    name: data.name ?? STORIA_FALLBACK.name,
    legalName: data.legal_name ?? STORIA_FALLBACK.legalName,
    brandName: data.brand_name ?? STORIA_FALLBACK.brandName,
    emailFromName: data.email_from_name ?? STORIA_FALLBACK.emailFromName,
    fromEmail: data.from_email ?? STORIA_FALLBACK.fromEmail,
    replyToEmail: data.reply_to_email ?? STORIA_FALLBACK.replyToEmail,
    contactEmail: data.contact_email ?? STORIA_FALLBACK.contactEmail,
    website: data.website ?? STORIA_FALLBACK.website,
    phone: data.phone ?? STORIA_FALLBACK.phone,
    addressStreet: data.address_street ?? STORIA_FALLBACK.addressStreet,
    addressZip: data.address_zip ?? STORIA_FALLBACK.addressZip,
    addressCity: data.address_city ?? STORIA_FALLBACK.addressCity,
    vatId: data.vat_id ?? STORIA_FALLBACK.vatId,
    logoUrl: data.logo_url ?? STORIA_FALLBACK.logoUrl,
    stripeAccountId: data.stripe_account_id ?? STORIA_FALLBACK.stripeAccountId,
  };
}

/** Baut den Resend/SMTP-Absender aus der Tenant-Config. */
export function tenantSender(config: TenantConfig): { from: string; replyTo: string } {
  return {
    from: `${config.emailFromName} <${config.fromEmail}>`,
    replyTo: config.replyToEmail,
  };
}

/**
 * Öffentlicher Pfad `/c/{slug}` → tenant_id. Unbekannter Slug → Default-Tenant.
 */
export async function resolveTenantFromSlug(
  client: SupabaseClient,
  slug: string | null | undefined,
): Promise<string> {
  if (!slug) return DEFAULT_TENANT_ID;
  const { data } = await client
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return data?.id ?? DEFAULT_TENANT_ID;
}

/**
 * Liest die tenant_id einer referenzierten Zeile (für Webhooks).
 * z.B. resolveTenantFromEntity(client, 'v2_events', eventId).
 * Zeile/Spalte fehlt → Default-Tenant (NON-BREAKING).
 */
export async function resolveTenantFromEntity(
  client: SupabaseClient,
  table: string,
  id: string | null | undefined,
  idColumn = 'id',
): Promise<string> {
  if (!id) return DEFAULT_TENANT_ID;
  const { data } = await client
    .from(table)
    .select('tenant_id')
    .eq(idColumn, id)
    .maybeSingle();
  return (data as { tenant_id?: string } | null)?.tenant_id ?? DEFAULT_TENANT_ID;
}
