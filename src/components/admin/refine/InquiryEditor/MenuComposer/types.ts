// Types for the Menu Composition System

export type CourseType = 
  | 'starter' 
  | 'pasta' 
  | 'main' 
  | 'main_fish' 
  | 'main_meat' 
  | 'dessert' 
  | 'fingerfood'
  | 'vegetarisch'
  | 'vegan';

export type DrinkGroupType =
  | 'aperitif'
  | 'main_drink'
  | 'water'
  | 'coffee'
  | 'custom';

// Extended item source type to include manual entries
export type ItemSource = 'catering' | 'ristorante' | 'custom' | 'manual';

export interface CourseConfig {
  id: string;
  package_id: string;
  course_type: CourseType;
  course_label: string;
  course_label_en: string | null;
  course_label_it?: string | null;
  course_label_fr?: string | null;
  is_required: boolean;
  allowed_sources: ('catering' | 'ristorante')[];
  allowed_categories: string[];
  is_custom_item: boolean;
  custom_item_name: string | null;
  custom_item_name_en: string | null;
  custom_item_name_it?: string | null;
  custom_item_name_fr?: string | null;
  custom_item_description: string | null;
  custom_item_description_en?: string | null;
  custom_item_description_it?: string | null;
  custom_item_description_fr?: string | null;
  sort_order: number;
}

export interface DrinkOption {
  type: string;
  label: string;
  quantity?: string;
}

export interface DrinkConfig {
  id: string;
  package_id: string;
  drink_group: DrinkGroupType;
  drink_label: string;
  drink_label_en: string | null;
  drink_label_it?: string | null;
  drink_label_fr?: string | null;
  options: DrinkOption[] | string[];
  /** Übersetzte Options-Listen pro Sprache, gleiche Reihenfolge wie `options` */
  options_translations?: Partial<Record<'en' | 'it' | 'fr', string[]>> | null;
  quantity_per_person: string | null;
  quantity_label: string | null;
  quantity_label_en: string | null;
  quantity_label_it?: string | null;
  quantity_label_fr?: string | null;
  is_choice: boolean;
  is_included: boolean;
  sort_order: number;
}

export interface CourseSelection {
  courseType: CourseType;
  courseLabel: string;
  courseLabel_en?: string | null;
  courseLabel_it?: string | null;
  courseLabel_fr?: string | null;
  itemId: string | null;
  itemName: string;
  itemName_en?: string | null;
  itemName_it?: string | null;
  itemName_fr?: string | null;
  itemDescription: string | null;
  itemDescription_en?: string | null;
  itemDescription_it?: string | null;
  itemDescription_fr?: string | null;
  itemSource: ItemSource;
  isCustom: boolean;
  /** Editierbarer Preis pro Position (bei quantity=1 = Preis pro Portion; bei quantity>1 = Gesamtpreis fuer diese Position) */
  overridePrice?: number | null;
  /** Menge bei per_event-Modus. Default 1. Wird beim Laden aus 'N x Foo'-Pattern im itemName migriert. */
  quantity?: number | null;
  /** Pro-Zeile Preismodus. 'per_person' = Preis × Gäste, 'flat' = Pauschalpreis (×1). Default 'per_person'. */
  priceMode?: 'per_person' | 'flat' | null;
}

export interface DrinkSelection {
  drinkGroup: DrinkGroupType;
  drinkLabel: string;
  drinkLabel_en?: string | null;
  drinkLabel_it?: string | null;
  drinkLabel_fr?: string | null;
  selectedChoice: string | null; // For is_choice = true groups
  /** Übersetzungen der ausgewählten Option (key = lang, value = übersetzte Bezeichnung) */
  selectedChoice_translations?: Partial<Record<'en' | 'it' | 'fr', string>> | null;
  quantityLabel: string | null;
  quantityLabel_en?: string | null;
  quantityLabel_it?: string | null;
  quantityLabel_fr?: string | null;
  customDrink?: string | null; // For manual drink entries
  /** Optionaler Einzelpreis (Brutto). Bei priceMode='per_person' × Gäste, bei 'flat' pauschal. */
  pricePerUnit?: number | null;
  /** Menge (Default 1). */
  quantity?: number | null;
  /** 'per_person' = Preis × Gäste × Menge, 'flat' = Preis × Menge (Default 'per_person'). */
  priceMode?: 'per_person' | 'flat' | null;
}

export interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category_name: string;
  source: 'catering' | 'ristorante';
}

export const COURSE_ICONS: Record<CourseType, string> = {
  starter: '🍽️',
  pasta: '🍝',
  main: '🥩',
  main_fish: '🐟',
  main_meat: '🥩',
  dessert: '🍰',
  fingerfood: '🥗',
  vegetarisch: '🌱',
  vegan: '🌿',
};

export const DRINK_ICONS: Record<DrinkGroupType, string> = {
  aperitif: '🍹',
  main_drink: '🍷',
  water: '💧',
  coffee: '☕',
  custom: '🥂',
};

/** Generisches Item für Equipment und Personal */
export interface EquipmentItem {
  id: string;
  name: string;
  pricePerUnit: number; // Brutto
  quantity: number;
}
