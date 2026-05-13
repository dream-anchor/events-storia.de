import { supabase } from '@/integrations/supabase/client';
import type { PrintInquiry } from './types';
import type { OfferBuilderOption } from '@/components/admin/refine/InquiryEditor/OfferBuilder/types';

/** Wandelt eine inquiry_offer_options-Row in OfferBuilderOption um (analog useOfferBuilder). */
function rowToOption(row: any): OfferBuilderOption {
  const ms = row.menu_selection ?? {};
  return {
    id: row.id,
    packageId: row.package_id ?? null,
    packageName: '',
    optionLabel: row.option_label ?? 'A',
    offerMode: ms.offerMode ?? 'menu',
    isActive: row.is_active ?? true,
    guestCount: row.guest_count ?? 0,
    menuSelection: {
      courses: ms.courses ?? [],
      drinks: ms.drinks ?? [],
      winePairingPrice: ms.winePairingPrice ?? null,
      drinksMode: ms.drinksMode,
      drinksPauschalePrice: ms.drinksPauschalePrice ?? null,
      drinksPauschaleDescription: ms.drinksPauschaleDescription ?? null,
      drinksEinzeln: ms.drinksEinzeln ?? [],
      equipment: ms.equipment ?? [],
      staff: ms.staff ?? [],
    },
    totalAmount: Number(row.total_amount ?? 0),
    stripePaymentLinkId: row.stripe_payment_link_id ?? null,
    stripePaymentLinkUrl: row.stripe_payment_link_url ?? null,
    offerVersion: row.offer_version ?? 1,
    sortOrder: row.sort_order ?? 0,
    budgetPerPerson: ms.budgetPerPerson ?? null,
    pricingMode: ms.pricingMode ?? 'per_person',
    discountPercent: ms.discountPercent ?? 0,
    discountAmount: ms.discountAmount ?? 0,
    attachMenu: ms.attachMenu ?? false,
    tableNote: ms.tableNote ?? null,
  };
}

function buildLocationAddress(inq: any): string | null {
  if (inq.location_type === 'storia') {
    return 'Ristorante Storia, Karlstr. 47a, 80333 München';
  }
  const street = inq.location_street || inq.delivery_street;
  const zip = inq.location_postal_code || inq.delivery_zip;
  const city = inq.location_city || inq.delivery_city;
  const name = inq.location_name;
  const parts = [name, street, [zip, city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function buildMapsUrl(parts: (string | null | undefined)[]): string | null {
  const joined = parts.filter(Boolean).join(', ').trim();
  if (!joined) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(joined)}`;
}

function shortOrderNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Lädt PrintInquiry für eine einzelne Anfrage. */
export async function fetchPrintInquiry(inquiryId: string): Promise<PrintInquiry | null> {
  const { data: inq, error } = await supabase
    .from('event_inquiries')
    .select('*')
    .eq('id', inquiryId)
    .maybeSingle();
  if (error || !inq) return null;

  // Lieferadress-Details kommen aus v2_events (im View nicht enthalten)
  const { data: v2 } = await supabase
    .from('v2_events')
    .select('delivery_floor,has_elevator,location_details,location_country')
    .eq('id', inquiryId)
    .maybeSingle();

  // Selected Option laden — falls vorhanden
  let selectedOption: OfferBuilderOption | null = null;
  let selectedLabel: string | null = null;
  if (inq.selected_option_id) {
    const { data: opt } = await supabase
      .from('inquiry_offer_options')
      .select('*')
      .eq('id', inq.selected_option_id)
      .maybeSingle();
    if (opt) {
      selectedOption = rowToOption(opt);
      selectedLabel = opt.option_label;
    }
  } else {
    // Fallback: aktivste Option der aktuellen Version
    const { data: opts } = await supabase
      .from('inquiry_offer_options')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1);
    if (opts && opts.length) {
      selectedOption = rowToOption(opts[0]);
      selectedLabel = opts[0].option_label;
    }
  }

  const guestCountNum = selectedOption?.guestCount || parseInt(inq.guest_count || '0', 10) || 0;
  const total = selectedOption?.totalAmount ?? 0;

  const isStoria = inq.location_type === 'storia';
  const street = isStoria ? null : (inq.location_street || inq.delivery_street || null);
  const zip = isStoria ? null : (inq.location_postal_code || inq.delivery_zip || null);
  const city = isStoria ? null : (inq.location_city || inq.delivery_city || null);
  const country = isStoria ? null : (v2?.location_country || 'Deutschland');
  const floor = isStoria ? null : (v2?.delivery_floor || null);

  return {
    id: String(inq.id),
    orderNumber: shortOrderNumber(String(inq.id)),
    contactName: inq.contact_name || '',
    companyName: inq.company_name,
    email: inq.email || '',
    phone: inq.phone,
    eventType: inq.event_type,
    preferredDate: inq.preferred_date,
    eventEndDate: inq.event_end_date,
    timeSlot: inq.time_slot,
    guestCount: guestCountNum,
    locationType: (inq.location_type as 'storia' | 'company' | 'custom' | null) ?? null,
    locationName: inq.location_name,
    locationAddress: buildLocationAddress(inq),
    roomSelection: inq.room_selection,
    isCatering: inq.inquiry_type === 'catering' || inq.location_type !== 'storia',
    locationStreet: street,
    locationZip: zip,
    locationCity: city,
    locationCountry: country,
    locationDetails: isStoria ? null : (v2?.location_details ?? null),
    deliveryFloor: floor,
    hasElevator: Boolean(v2?.has_elevator),
    mapsUrl: isStoria ? null : buildMapsUrl([inq.location_name, street, zip, city, country]),
    internalNotes: inq.internal_notes,
    customerMessage: inq.message,
    status: inq.status || 'new',
    offerPhase: inq.offer_phase,
    totalAmount: total,
    paidAmount: Number(inq.paid_amount ?? 0),
    remainingAmount: Number(inq.remaining_amount ?? 0),
    depositAmount: inq.deposit_amount ? Number(inq.deposit_amount) : null,
    paymentMethod: inq.payment_method,
    lexofficeInvoiceId: inq.lexoffice_invoice_id,
    selectedOption,
    selectedOptionLabel: selectedLabel,
    allergens: extractAllergens(inq.internal_notes, inq.message),
    currentVersion: inq.current_offer_version ?? 0,
  };
}

/** Heuristik: zieht Allergie-Hinweise aus Texten heraus. */
function extractAllergens(...texts: (string | null)[]): string | null {
  const keywords = /allerg|unverträglich|gluten|lactose|laktose|vegetarier|vegan|nuss|nüsse/i;
  for (const t of texts) {
    if (!t) continue;
    const lines = t.split(/\n+/).filter((l) => keywords.test(l));
    if (lines.length) return lines.join(' • ');
  }
  return null;
}

/** Lädt mehrere Anfragen parallel. */
export async function fetchPrintInquiries(ids: string[]): Promise<PrintInquiry[]> {
  const results = await Promise.all(ids.map((id) => fetchPrintInquiry(id)));
  return results.filter((r): r is PrintInquiry => r !== null);
}