// OfferBuilder Type System
// Ersetzt MultiOffer/types.ts mit Erweiterungen für 3-Modi und 2-Phasen-Flow

// Re-export bestehende Types aus MenuComposer (werden weiterverwendet)
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
} from '../MenuComposer/types';

export { COURSE_ICONS, DRINK_ICONS } from '../MenuComposer/types';

// Re-export MenuSelection aus MenuComposer (identische Struktur)
export type { MenuSelection as MenuSelectionType } from '../MenuComposer/types';

// Re-export aus InquiryEditor types
export type { ExtendedInquiry, Package, EmailTemplate, SelectedPackage } from '../types';

// Re-export CombinedMenuItem aus Hook
export type { CombinedMenuItem } from '@/hooks/useCombinedMenuItems';

// --- Neue Types ---

export type OfferMode = 'a_la_carte' | 'teil_menu' | 'fest_menu';

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
    mode: 'a_la_carte',
    label: 'À la carte',
    description: 'Gäste bestellen frei von unserer Speisekarte',
    icon: 'utensils',
  },
  {
    mode: 'teil_menu',
    label: 'Teil-Menü',
    description: 'Vorspeise vorbestellt, Rest à la carte vor Ort',
    icon: 'utensils-crossed',
  },
  {
    mode: 'fest_menu',
    label: 'Fest-Menü',
    description: 'Komplettes Menü (2–10+ Gänge) vordefiniert',
    icon: 'chef-hat',
  },
];

/** Leere Option erstellen */
export function createEmptyOption(
  label: string,
  guestCount: number,
  mode: OfferMode = 'fest_menu',
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
  saveStatus: 'idle' | 'saving' | 'saved';

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
