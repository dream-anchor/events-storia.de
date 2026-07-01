// OfferBuilder Type System
// Ersetzt MultiOffer/types.ts mit Erweiterungen für 3-Modi und 2-Phasen-Flow

// Re-export bestehende Types aus MenuComposer (werden weiterverwendet)
import type {
  CourseType,
  DrinkGroupType,
  ItemSource,
  CourseConfig,
  DrinkConfig,
  DrinkOption,
  CourseSelection,
  DrinkSelection,
  MenuItem,
  EquipmentItem,
} from '../MenuComposer/types';

export type {
  CourseType,
  DrinkGroupType,
  ItemSource,
  CourseConfig,
  DrinkConfig,
  DrinkOption,
  CourseSelection,
  DrinkSelection,
  MenuItem,
  EquipmentItem,
};

export { COURSE_ICONS, DRINK_ICONS } from '../MenuComposer/types';

// Re-export MenuSelection aus MenuComposer (identische Struktur)
export type { MenuSelection as MenuSelectionType } from '../MenuComposer/types';

// Re-export aus InquiryEditor types
export type { ExtendedInquiry, Package, EmailTemplate, SelectedPackage } from '../types';

// Re-export CombinedMenuItem aus Hook
import type { CombinedMenuItem } from '@/hooks/useCombinedMenuItems';
export type { CombinedMenuItem };

// --- Neue Types ---

/**
 * OfferMode pro Option:
 * - 'unselected': neue Karte ohne Modus → zeigt Typ-Auswahl-Kacheln (nur In-Memory, wird NICHT persistiert)
 * - 'menu': Eigenes Menü (freie Gangkonfiguration) ODER importiertes Restaurant-Menü
 * - 'paket': Fertigpaket aus DB
 * - 'email': Nur Anschreiben, keine Menükonfiguration
 */
export type OfferMode = 'unselected' | 'menu' | 'paket' | 'email' | 'freeform';

/**
 * FreeformProgram — KI-importierte mehrtägige Programme (z.B. Catering-Spike-Weeks).
 * Wird in menuSelection.freeformProgram persistiert. Preise sind 1:1 aus Text übernommen.
 */
export interface FreeformProgramSection {
  heading?: string | null;
  items: FreeformProgramSectionItem[];
}

/**
 * Einzelne Position innerhalb einer Section (z.B. "2 × Pizza Margherita à 12 €").
 * Wird im Freitext-Import als Zeile mit Menge/Name/Preis bearbeitet — analog zum
 * Eigenes-Menü-Wizard. Preise sind NETTO.
 */
export interface FreeformProgramSectionItem {
  quantity: number;
  name: string;
  unitPriceNet: number;
  /**
   * Wie der Preis in die Mahlzeit-/Gesamtsumme einfließt:
   * - 'per_person' (Default): unitPriceNet × quantity
   * - 'flat': unitPriceNet als Pauschale (1×), unabhängig von quantity
   */
  priceMode?: 'per_person' | 'flat';
}

export interface FreeformProgramMeal {
  id: string;
  label: string;
  guestCount: number;
  sections: FreeformProgramSection[];
  flatPriceNet: number;
  vatRate: number;
  /** Optional: Preis pro Person (netto). Wird gesetzt, wenn der Text "X € pro Person" nennt. */
  pricePerPersonNet?: number | null;
  /** Optional: Präfix wörtlich aus dem Text, z.B. "ab", "ca.". Nur Anzeige. */
  pricePerPersonPrefix?: string | null;
}

export interface FreeformProgramDay {
  id: string;
  dateLabel: string;
  isoDate?: string | null;
  meals: FreeformProgramMeal[];
}

export interface FreeformProgramTaxBreakdown {
  foodNet: number;
  foodVatRate: number;
  foodVatAmount?: number | null;
  servicesNet: number;
  servicesVatRate: number;
  servicesVatAmount?: number | null;
}

export interface FreeformProgram {
  title: string;
  location?: string | null;
  dateRangeLabel?: string | null;
  scopeOfServices?: string[] | null;
  days: FreeformProgramDay[];
  taxBreakdown: FreeformProgramTaxBreakdown;
  totalsFromText: { net: number; gross: number };
  notes?: string[] | null;
  rawText?: string | null;
  /** Optionaler Rabatt — wird vom Brutto-Gesamtbetrag abgezogen. */
  discount?: { mode: 'percent' | 'amount'; value: number } | null;
  /** Zusätzliche Leistungen wie Service-Personal (€/h), Anfahrt (Pauschal) etc. */
  additionalServices?: FreeformAdditionalService[] | null;
}

/**
 * Ein Tages-Menü innerhalb einer Angebots-Option. Erlaubt mehrtägige Programme
 * (z.B. Spike-Weeks) im Standard-Menü-Wizard: jeder Tag hat seine eigene
 * `courses[]`-Liste — sonst identisch zum Handmenü.
 *
 * Bei 1 Tag mit leerem `dateLabel` verhält sich der Wizard exakt wie heute
 * (Tabs sind unsichtbar). Erst bei mehreren Tagen wird die Tages-Tab-Leiste
 * über dem Wizard sichtbar.
 */
export interface MenuDay {
  id: string;
  /** Anzeigelabel im Tab, z.B. "Mo 29.06." — leer bei implizitem Ein-Tag-Menü. */
  dateLabel: string;
  /** Optionales ISO-Datum (YYYY-MM-DD) für strukturierte Verwendung. */
  isoDate?: string | null;
  /** Optionaler Mahlzeit-Suffix, z.B. "Lunch" / "Dinner". */
  mealLabel?: string | null;
  /** Optionale Gästezahl pro Tag; fällt sonst auf `option.guestCount` zurück. */
  guestCount?: number | null;
  /** Gang-Liste — identisch zum handgemachten Menü. */
  courses: import('../MenuComposer/types').CourseSelection[];
}

/** Zusatzleistung (Personal nach Stunden, Anfahrt-Pauschale, Equipment-Stück etc.). */
export interface FreeformAdditionalService {
  id: string;
  label: string;
  /** Einzelpreis netto pro Einheit (Stunde/Pauschal/Stück). */
  unitPriceNet: number;
  /** Einheit. 'hour' = €/h, 'flat' = Pauschale, 'piece' = €/Stück. */
  unit: 'hour' | 'flat' | 'piece';
  /** Menge (Stunden / Stücke). Bei 'flat' optional, sonst Default 1. */
  quantity?: number | null;
  /** MwSt-Satz (Default 19 für Dienstleistungen). */
  vatRate: number;
}

/** Red-Team-Validation-Finding (transient, nicht persistiert). */
export interface ValidationFinding {
  severity: 'critical' | 'warning';
  category: 'completeness' | 'pricing' | 'guests_dates' | 'notes';
  path: string;
  expected: string;
  actual: string;
  message: string;
}

export type DrinkSectionMode = 'none' | 'pauschale' | 'weinbegleitung' | 'einzeln';

export interface DrinkEinzelnItem {
  id: string;
  name: string;
  /** Einzelpreis. Bei pricingMode='per_person' = Preis pro Gast. Bei pricingMode='per_event' = Preis pro Stueck (Zeilen-Total = quantity * pricePerPerson). */
  pricePerPerson: number;
  /** Menge bei per_event-Bestellungen. Default 1. Analog zu CourseSelection.quantity. */
  quantity?: number | null;
  /** Pro-Zeile Preismodus. 'per_person' = Preis × Gäste, 'flat' = Pauschalpreis (×1). Default 'per_person'. */
  priceMode?: 'per_person' | 'flat' | null;
}

export type OfferPhase =
  | 'draft'
  | 'proposal_sent'
  | 'customer_responded'
  | 'final_draft'
  | 'final_sent'
  | 'confirmed'
  | 'paid';

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;
export type OptionLabel = typeof OPTION_LABELS[number];

/** Eine Angebotsoption im neuen OfferBuilder — erweitert um offerMode */
export interface OfferBuilderOption {
  id: string;
  packageId: string | null;
  packageName: string;
  optionLabel: string;
  offerMode: OfferMode;
  isActive: boolean;
  guestCount: number;
  menuSelection: {
    courses: import('../MenuComposer/types').CourseSelection[];
    drinks: import('../MenuComposer/types').DrinkSelection[];
    winePairingPrice?: number | null;
    drinksMode?: DrinkSectionMode;
    drinksPauschalePrice?: number | null;
    drinksPauschaleDescription?: string | null;
    drinksEinzeln?: DrinkEinzelnItem[];
    equipment?: EquipmentItem[];
    staff?: EquipmentItem[];
    freeformProgram?: FreeformProgram | null;
  };
  totalAmount: number;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  offerVersion: number;
  createdInVersion?: number;
  sortOrder: number;
  // Neue Felder für den OfferBuilder
  budgetPerPerson: number | null;
  /**
   * Pricing-Modus:
   * - 'per_person' (Default): budgetPerPerson ist Preis pro Gast, totalAmount = budgetPerPerson * guestCount
   * - 'per_event': budgetPerPerson wird als Gesamtpreis interpretiert, totalAmount = budgetPerPerson
   *
   * Auto-Detection bei fehlendem Wert: 'per_event' wenn Kurse absolute Mengen haben
   * (z.B. "11 x Salat"), sonst 'per_person'.
   */
  pricingMode?: 'per_person' | 'per_event';
  /** Rabatt-Prozentsatz (0–100, default 25) — wird in menu_selection.discountPercent gespeichert */
  discountPercent: number;
  /** Rabatt als fester €-Betrag — wenn > 0, hat Vorrang vor discountPercent */
  discountAmount: number;
  attachMenu: boolean;
  tableNote: string | null;
  /**
   * TRANSIENT — nicht persistiert (saveOptionsToDb pickt nur bekannte Felder).
   * Markiert eine Option als „aus KI-Entwurf übernommen" — rein für UI-Badge.
   */
  aiOrigin?: boolean;
  /**
   * TRANSIENT — nicht persistiert. Wenn true, ist die Option ein KI-Vorschlag,
   * der vom Betreiber bewusst über „KI-Vorschlag speichern" persistiert werden muss.
   * Wird beim ersten Save (oder beim Klick auf Save-Button) auf false gesetzt.
   */
  needsManualSave?: boolean;
}

/** Kunden-Antwort aus offer_customer_responses */
export interface CustomerResponse {
  id: string;
  selectedOptionId: string | null;
  customerNotes: string | null;
  respondedAt: string;
}

/** Version-History Eintrag */
export interface OfferHistoryEntry {
  id: string;
  version: number;
  sentAt: string;
  sentBy: string | null;
  emailContent: string | null;
  pdfUrl: string | null;
  optionsSnapshot: OfferBuilderOption[];
}

/** ModeSelector Konfiguration */
export interface OfferModeConfig {
  mode: OfferMode;
  label: string;
  description: string;
  icon: string;
}

export const OFFER_MODES: OfferModeConfig[] = [
  {
    mode: 'menu',
    label: 'Menü',
    description: 'Gänge frei zusammenstellen — von 1 Vorspeise bis 10-Gänge-Menü',
    icon: 'chef-hat',
  },
  {
    mode: 'paket',
    label: 'Paket',
    description: 'Fertigpakete aus der Datenbank wählen',
    icon: 'package',
  },
  {
    mode: 'email',
    label: 'E-Mail',
    description: 'Freie Antwort — Reservierung, Info oder individuelle Nachricht',
    icon: 'mail',
  },
];

/** Default-Gangtypen für Menü-Modus (ohne Paket-Abhängigkeit) */
export const DEFAULT_COURSE_CONFIGS: CourseConfig[] = [
  { id: 'def-starter', package_id: '', course_type: 'starter', course_label: 'Antipasto', course_label_en: 'Starter', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 1 },
  { id: 'def-pasta', package_id: '', course_type: 'pasta', course_label: 'Pasta', course_label_en: 'Pasta', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 2 },
  { id: 'def-main', package_id: '', course_type: 'main', course_label: 'Hauptgang', course_label_en: 'Main Course', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 3 },
  { id: 'def-main-fish', package_id: '', course_type: 'main_fish', course_label: 'Fisch', course_label_en: 'Fish', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 4 },
  { id: 'def-main-meat', package_id: '', course_type: 'main_meat', course_label: 'Fleisch', course_label_en: 'Meat', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 5 },
  { id: 'def-dessert', package_id: '', course_type: 'dessert', course_label: 'Dessert', course_label_en: 'Dessert', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 6 },
  { id: 'def-fingerfood', package_id: '', course_type: 'fingerfood', course_label: 'Fingerfood', course_label_en: 'Finger Food', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 7 },
  { id: 'def-vegetarisch', package_id: '', course_type: 'vegetarisch', course_label: 'Vegetarisch', course_label_en: 'Vegetarian', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 8 },
  { id: 'def-vegan', package_id: '', course_type: 'vegan', course_label: 'Vegan', course_label_en: 'Vegan', is_required: false, allowed_sources: ['catering', 'ristorante'], allowed_categories: [], is_custom_item: false, custom_item_name: null, custom_item_name_en: null, custom_item_description: null, sort_order: 9 },
];

/** Default-Getränkegruppen für Menü-Modus (ohne Paket-Abhängigkeit) */
export const DEFAULT_DRINK_CONFIGS: DrinkConfig[] = [
  { id: 'def-aperitif', package_id: '', drink_group: 'aperitif', drink_label: 'Aperitif', drink_label_en: 'Aperitif', options: [], quantity_per_person: null, quantity_label: null, quantity_label_en: null, is_choice: false, is_included: false, sort_order: 1 },
  { id: 'def-main-drink', package_id: '', drink_group: 'main_drink', drink_label: 'Weinbegleitung', drink_label_en: 'Wine Pairing', options: [], quantity_per_person: null, quantity_label: null, quantity_label_en: null, is_choice: false, is_included: false, sort_order: 2 },
  { id: 'def-water', package_id: '', drink_group: 'water', drink_label: 'Wasser', drink_label_en: 'Water', options: [], quantity_per_person: null, quantity_label: null, quantity_label_en: null, is_choice: false, is_included: false, sort_order: 3 },
  { id: 'def-coffee', package_id: '', drink_group: 'coffee', drink_label: 'Kaffee', drink_label_en: 'Coffee', options: [], quantity_per_person: null, quantity_label: null, quantity_label_en: null, is_choice: false, is_included: false, sort_order: 4 },
];

/** Leere Option erstellen */
export function createEmptyOption(
  label: string,
  guestCount: number,
  mode: OfferMode = 'menu',
): Omit<OfferBuilderOption, 'id'> {
  return {
    packageId: null,
    packageName: '',
    optionLabel: label,
    offerMode: mode,
    isActive: true,
    guestCount,
    menuSelection: { courses: [], drinks: [] },
    totalAmount: 0,
    stripePaymentLinkId: null,
    stripePaymentLinkUrl: null,
    offerVersion: 1,
    sortOrder: OPTION_LABELS.indexOf(label as OptionLabel),
    budgetPerPerson: null,
    pricingMode: 'per_person',
    discountPercent: 0,
    discountAmount: 0,
    attachMenu: false,
    tableNote: null,
  };
}

/** Result von sendProposal — wird vom Erfolgs-Modal genutzt (Bug 3). */
export interface SendProposalResult {
  emailSent: boolean;
  recipient: string | null;
  messageId: string | null;
  sentAt: string;
  version: number;
  lexofficeQuotationId: string | null;
  errorMessage: string | null;
}

/** Return type des useOfferBuilder Hooks */
export interface UseOfferBuilderReturn {
  // State
  options: OfferBuilderOption[];
  offerPhase: OfferPhase;
  currentVersion: number;
  history: OfferHistoryEntry[];
  customerResponse: CustomerResponse | null;

  // Daten für UI-Komponenten
  packageConfigs: Record<string, { courses: CourseConfig[]; drinks: DrinkConfig[] }>;
  menuItems: CombinedMenuItem[];

  // Loading/Status
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  // Option CRUD
  addOption: (mode?: OfferMode, copyFrom?: OfferBuilderOption) => string | undefined;
  removeOption: (optionId: string) => void;
  /**
   * Setzt eine Option auf den Initialzustand zurueck — Kachel-Auswahl ('unselected')
   * erscheint wieder, alle Inhalte (Kurse, Getraenke, Equipment, Personal, Freeform,
   * KI-Marker) werden entfernt. id/optionLabel/sortOrder bleiben erhalten.
   */
  resetOption: (optionId: string) => void;
  importOptions: (partials: Partial<OfferBuilderOption>[]) => void;
  /**
   * Fügt einen AI-Draft-Vorschlag NUR in den lokalen UI-State ein.
   * Triggert KEINEN Auto-Save (kein Write in `v2_offer_options`).
   * Erst manuelle Bearbeitung/Speichern persistiert.
   * Liefert `true` wenn eine Option hinzugefügt wurde.
   */
  addAiDraftPreview: (partial: Partial<OfferBuilderOption>) => boolean;
  updateOption: (optionId: string, updates: Partial<OfferBuilderOption>) => void;
  toggleOptionActive: (optionId: string) => void;

  // Flush pending saves (returns Promise so callers can await)
  flushSave: () => Promise<void> | void;

  // Persistence
  saveOptions: () => Promise<void>;
  createNewVersion: (emailContent: string) => Promise<number>;
  unlockForNewVersion: () => Promise<number>;

  // Phase-Transitions
  sendProposal: (emailContent: string) => Promise<SendProposalResult | void>;
  sendFinalOffer: (emailContent: string) => Promise<void>;

  // Computed
  activeOptions: OfferBuilderOption[];
  isLocked: boolean;
  setOptions: React.Dispatch<React.SetStateAction<OfferBuilderOption[]>>;
}
