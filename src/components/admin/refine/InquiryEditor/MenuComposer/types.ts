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
  is_required: boolean;
  allowed_sources: ('catering' | 'ristorante')[];
  allowed_categories: string[];
  is_custom_item: boolean;
  custom_item_name: string | null;
  custom_item_name_en: string | null;
  custom_item_description: string | null;
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
  options: DrinkOption[] | string[];
  quantity_per_person: string | null;
  quantity_label: string | null;
  quantity_label_en: string | null;
  is_choice: boolean;
  is_included: boolean;
  sort_order: number;
}

export interface CourseSelection {
  courseType: CourseType;
  courseLabel: string;
  itemId: string | null;
  itemName: string;
  itemDescription: string | null;
  itemSource: ItemSource;
  isCustom: boolean;
  /** Editierbarer Preis pro Position (bei quantity=1 = Preis pro Portion; bei quantity>1 = Gesamtpreis fuer diese Position) */
  overridePrice?: number | null;
  /** Menge bei per_event-Modus. Default 1. Wird beim Laden aus 'N x Foo'-Pattern im itemName migriert. */
  quantity?: number | null;
}

export interface DrinkSelection {
  drinkGroup: DrinkGroupType;
  drinkLabel: string;
  selectedChoice: string | null; // For is_choice = true groups
  quantityLabel: string | null;
  customDrink?: string | null; // For manual drink entries
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
