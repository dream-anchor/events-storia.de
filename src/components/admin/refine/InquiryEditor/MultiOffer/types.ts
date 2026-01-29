// Types for the Multi-Offer System

export interface CourseSelectionType {
  courseType: string;
  courseLabel: string;
  itemId: string | null;
  itemName: string;
  itemDescription: string | null;
  itemSource: string;
  isCustom: boolean;
}

export interface DrinkSelectionType {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
  customDrink?: string | null;
}

export interface MenuSelectionType {
  courses: CourseSelectionType[];
  drinks: DrinkSelectionType[];
}

export interface OfferOption {
  id: string;
  packageId: string | null;
  packageName: string;
  optionLabel: string; // "A", "B", "C"
  isActive: boolean;
  guestCount: number;
  menuSelection: MenuSelectionType;
  totalAmount: number;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  offerVersion: number;
  sortOrder: number;
}

export interface OfferState {
  inquiryId: string;
  currentVersion: number;
  options: OfferOption[];
  emailDraft: string;
  notes: string;
}

export interface OfferHistoryEntry {
  id: string;
  version: number;
  sentAt: string;
  sentBy: string | null;
  emailContent: string | null;
  pdfUrl: string | null;
  optionsSnapshot: OfferOption[];
}

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

export function createEmptyOption(label: string, guestCount: number): Omit<OfferOption, 'id'> {
  return {
    packageId: null,
    packageName: '',
    optionLabel: label,
    isActive: true,
    guestCount,
    menuSelection: { courses: [], drinks: [] },
    totalAmount: 0,
    stripePaymentLinkId: null,
    stripePaymentLinkUrl: null,
    offerVersion: 1,
    sortOrder: OPTION_LABELS.indexOf(label as typeof OPTION_LABELS[number]),
  };
}

export function calculateOptionTotal(
  option: OfferOption,
  packagePrice: number,
  pricePerPerson: boolean
): number {
  if (!option.packageId) return 0;
  return pricePerPerson ? packagePrice * option.guestCount : packagePrice;
}
