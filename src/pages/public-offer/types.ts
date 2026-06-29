import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

// --- Types ---

export type OfferPhase =
  | "draft"
  | "proposal_sent"
  | "customer_responded"
  | "final_draft"
  | "final_sent"
  | "confirmed"
  | "order_confirmed"
  | "paid";

export interface PublicInquiry {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string | null;
  event_type: string | null;
  preferred_date: string | null;
  event_end_date: string | null;
  guest_count: string | null;
  status: string;
  offer_phase: OfferPhase;
  selected_option_id: string | null;
  email_content: string | null;
  lexoffice_invoice_id: string | null;
  deposit_percent?: number | null;
  deposit_amount?: number | null;
  deposit_due_days?: number | null;
  offer_validity_days?: number | null;
  payment_method?: string | null;
  invoice_due_days?: number | null;
  /** Customer-facing language chosen by admin. Drives the public offer + emails. */
  customer_language?: 'de' | 'en' | 'it' | 'fr' | null;
  /** Public offer slug — required for public cost-acceptance endpoints. */
  offer_slug?: string | null;
}

export interface CourseSelection {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
  quantity?: number | null;
  overridePrice?: number | null;
  priceMode?: 'per_person' | 'flat' | null;
}

export interface DrinkSelection {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
  customDrink?: string | null;
}

export interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection[];
  winePairingPrice?: number | null;
  budgetPerPerson?: number | null;
  pricingMode?: 'per_person' | 'per_event';
  equipment?: Array<{ id: string; name: string; pricePerUnit: number; quantity: number }>;
  staff?: Array<{ id: string; name: string; pricePerUnit: number; quantity: number }>;
  freeformProgram?: PublicFreeformProgram | null;
}

/**
 * Mehrtägiges Freitext-Programm (KI-importiert). Wird tagestrukturiert
 * im Public Offer dargestellt — Preise 1:1 aus Maestro/Text.
 */
export interface PublicFreeformProgramMeal {
  id?: string;
  label: string;
  guestCount: number;
  sections: Array<{ heading?: string | null; items: PublicFreeformProgramSectionItem[] }>;
  flatPriceNet: number;
  vatRate: number;
}

export interface PublicFreeformProgramSectionItem {
  quantity: number;
  name: string;
  unitPriceNet: number;
  priceMode?: 'per_person' | 'flat';
}

export interface PublicFreeformProgramDay {
  id?: string;
  dateLabel: string;
  isoDate?: string | null;
  meals: PublicFreeformProgramMeal[];
}

export interface PublicFreeformProgram {
  title: string;
  location?: string | null;
  dateRangeLabel?: string | null;
  scopeOfServices?: string[] | null;
  days: PublicFreeformProgramDay[];
  taxBreakdown: {
    foodNet: number;
    foodVatRate: number;
    foodVatAmount?: number | null;
    servicesNet: number;
    servicesVatRate: number;
    servicesVatAmount?: number | null;
  };
  totalsFromText: { net: number; gross: number };
  notes?: string[] | null;
  discount?: { mode: 'percent' | 'amount'; value: number } | null;
}

export interface PublicOfferOption {
  id: string;
  option_label: string;
  offer_mode: string;
  guest_count: number;
  menu_selection: MenuSelection | null;
  total_amount: number;
  stripe_payment_link_url: string | null;
  package_name: string;
  package_description?: string | null;
  package_includes?: string[] | null;
  sort_order: number;
  selected_quantity?: number | null;
}

export interface CustomerResponseData {
  id: string;
  selected_option_id: string | null;
  customer_notes: string | null;
  responded_at: string | null;
}

export interface PublicOfferData {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  customer_response: CustomerResponseData | null;
}

export interface PublicPayment {
  id: string;
  payment_type: "deposit" | "prepayment" | "final";
  amount_cents: number;
  status: "draft" | "sent" | "paid" | "overdue";
  due_date: string | null;
  due_days_before_event: number | null;
  paid_at: string | null;
  paid_via: string | null;
  stripe_payment_link_url: string | null;
}

// --- Utility Functions ---

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    // Beträge IMMER mit 2 Nachkommastellen anzeigen — niemals auf- oder abrunden.
    // Maestro liefert exakte Preise (1:1 übernehmen, auch am Zahl-Button).
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyDecimal(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface DrinkRow {
  label: string;
  name: string;
  price: number | null;
  priceSuffix: string;
}

export function buildDrinkRows(menu: MenuSelection | null): DrinkRow[] {
  if (!menu) return [];
  const m = menu as MenuSelection & {
    drinksMode?: 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';
    drinksPauschalePrice?: number | null;
    drinksPauschaleDescription?: string | null;
    drinksEinzeln?: Array<{ name: string; pricePerPerson: number; quantity?: number | null }>;
  };
  const mode = m.drinksMode;
  const isPerEvent = m.pricingMode === 'per_event';
  const perPersonSuffix = isPerEvent ? '' : ' pro Person';

  if (mode === 'einzeln' && Array.isArray(m.drinksEinzeln)) {
    return m.drinksEinzeln
      .filter((d) => d?.name)
      .map((d) => {
        const qty = d.quantity ?? 1;
        return {
          label: 'Getränk',
          name: qty > 1 ? `${qty} × ${d.name}` : d.name,
          price: null,
          priceSuffix: '',
        };
      });
  }

  if (mode === 'pauschale') {
    const price = m.drinksPauschalePrice ?? null;
    const desc = m.drinksPauschaleDescription?.trim();
    return [{
      label: 'Getränke',
      name: desc || 'Getränkepauschale',
      price,
      priceSuffix: price !== null ? perPersonSuffix : '',
    }];
  }

  if (mode === 'weinbegleitung') {
    const price = m.winePairingPrice ?? null;
    return [{
      label: 'Getränke',
      name: 'Weinbegleitung zum Menü',
      price,
      priceSuffix: price !== null ? perPersonSuffix : '',
    }];
  }

  // Legacy / 'none' / kein Modus → klassische drinks[]
  if (Array.isArray(m.drinks) && m.drinks.length > 0) {
    return m.drinks.filter(d => d?.drinkLabel).map(d => ({
      label: d.drinkGroup || 'Getränk',
      name: d.customDrink || d.selectedChoice || d.drinkLabel,
      price: null,
      priceSuffix: '',
    }));
  }

  return [];
}

export function isCustomerSelectionComplete(
  options: PublicOfferOption[],
  phase: OfferPhase,
): boolean {
  if (options.length === 1) return true;
  if (options.length === 0) return false;
  return ['customer_responded', 'final_draft', 'final_sent', 'confirmed', 'paid']
    .includes(phase);
}

export function formatDate(date: string, formatStr: string = "d. MMMM yyyy") {
  return format(parseISO(date), formatStr, { locale: de });
}