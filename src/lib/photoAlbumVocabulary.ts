// Shared vocabulary for the photo album (kept in sync with edge function classify-photo)
export const PHOTO_CATEGORIES = [
  "pizza", "pasta", "risotto", "antipasti", "salat", "suppe",
  "fleisch", "fisch", "dessert", "beilage", "getränk", "cocktail",
  "wein", "kaffee", "ambiente", "team",
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
  cocktail: "Cocktail",
  wein: "Wein",
  kaffee: "Kaffee",
  ambiente: "Ambiente",
  team: "Team",
  sonstiges: "Sonstiges",
};

export const PHOTO_TAGS_BY_CATEGORY: Record<string, string[]> = {
  pizza: ["margherita","marinara","napoletana","pizza-bianca","parmaschinken","salami-piccante","lachs","thunfisch","4-formaggi","calzone","steinofen"],
  pasta: ["spaghetti","tagliolini","tagliatelle","paccheri","penne","orecchiette","fusilli","gnocchi","ravioli","cavatelli","carbonara","arrabbiata","scampi","ragout"],
  risotto: ["steinpilze","spargel","lachs","safran","kürbis"],
  antipasti: ["caprese","burrata","vitello-tonnato","carpaccio","oktopus","tatar","roastbeef","spargel","rote-bete","hummer"],
  salat: ["insalata-mista","burrata","ziegenkäse","lachs","caesar","roastbeef","avocado"],
  suppe: ["spargelcreme","fischsuppe","brokkoli"],
  fleisch: ["kalb","ossobuco","lamm","rinderfilet","rib-eye","tagliata","dry-aged","lavastein"],
  fisch: ["dorade","oktopus","thunfisch","wolfsbarsch","pesce-misto","salzkruste"],
  dessert: ["tiramisu","schokoladensoufflé","zitronentörtchen","panna-cotta","sorbet","eis"],
  beilage: ["grillgemüse","ofenkartoffeln","kartoffelpüree","frühlingsgemüse"],
  "getränk": [],
  cocktail: ["aperol-spritz","negroni","spritz","martini","mojito","caipirinha","gin-tonic","champagner","aperitivo"],
  wein: ["rotwein","weißwein","roséwein","spumante","prosecco","champagner","magnum","flasche","glas"],
  kaffee: ["espresso","cappuccino","latte-macchiato","affogato"],
  ambiente: ["innenraum","terrasse","bar","tisch-gedeckt","steinofen","detail"],
  team: ["familie-speranza","küche","service"],
};

export const PHOTO_CROSS_TAGS: string[] = [];

export const ALL_PHOTO_TAGS = Array.from(
  new Set([...Object.values(PHOTO_TAGS_BY_CATEGORY).flat(), ...PHOTO_CROSS_TAGS])
).sort();