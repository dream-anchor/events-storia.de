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

export type OfferMode = 'menu' | 'paket' | 'email';

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
  };
  totalAmount: number;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  offerVersion: number;
  createdInVersion?: number;
  sortOrder: number;
  // Neue Felder für den OfferBuilder
  budgetPerPerson: number | null;
  attachMenu: boolean;
  tableNote: string | null;
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
    description: 'Network Aperitivo · Business Dinner · Gesamte Location',
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
    attachMenu: false,
    tableNote: null,
  };
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
  addOption: (mode?: OfferMode) => void;
  removeOption: (optionId: string) => void;
  updateOption: (optionId: string, updates: Partial<OfferBuilderOption>) => void;
  toggleOptionActive: (optionId: string) => void;

  // Persistence
  saveOptions: () => Promise<void>;
  createNewVersion: (emailContent: string) => Promise<number>;
  unlockForNewVersion: () => Promise<number>;

  // Phase-Transitions
  sendProposal: (emailContent: string) => Promise<void>;
  sendFinalOffer: (emailContent: string) => Promise<void>;

  // Computed
  activeOptions: OfferBuilderOption[];
  isLocked: boolean;
  setOptions: React.Dispatch<React.SetStateAction<OfferBuilderOption[]>>;
}
