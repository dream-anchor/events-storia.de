// Shared vocabulary for the photo album (kept in sync with edge function classify-photo)
export const PHOTO_CATEGORIES = [
  "pizza", "pasta", "risotto", "antipasti", "salat", "suppe",
  "fleisch", "fisch", "dessert", "beilage", "getränk",
  "ambiente", "team",
] as const;

export type PhotoCategory = typeof PHOTO_CATEGORIES[number] | "sonstiges";

export const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  pizza: "Pizza",
  pasta: "Pasta",
  risotto: "Risotto",
  antipasti: "Antipasti",
  salat: "Salat",
  suppe: "Suppe",
  fleisch: "Fleisch",
  fisch: "Fisch",
  dessert: "Dessert",
  beilage: "Beilage",
  "getränk": "Getränk",
  ambiente: "Ambiente",
  team: "Team",
  sonstiges: "Sonstiges",
};

export const PHOTO_TAGS_BY_CATEGORY: Record<string, string[]> = {
  pizza: [],
  pasta: [],
  risotto: [],
  antipasti: [],
  salat: [],
  suppe: [],
  fleisch: [],
  fisch: [],
  dessert: [],
  beilage: [],
  "getränk": [],
  ambiente: [],
  team: [],
};

export const PHOTO_CROSS_TAGS: string[] = [];

export const ALL_PHOTO_TAGS = Array.from(
  new Set([...Object.values(PHOTO_TAGS_BY_CATEGORY).flat(), ...PHOTO_CROSS_TAGS])
).sort();