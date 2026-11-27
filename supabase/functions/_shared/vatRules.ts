// Umsatzsteuer-Regeln des Shops: EINZIGE Stelle für Paket-Kennzeichnung, Chafing-Satz und Liefer-Satz.
// Import-frei: wird von den Edge Functions (Deno) UND vom Checkout (src/, Vite) genutzt (src/lib/vatRules.ts re-exportiert).
//
// Entscheidungen des Betreibers (Mimmo, bestätigt von Antoine, 27.11.2026), Grundlage § 12 Abs. 2 Nr. 15 UStG ab 01.01.2026
// und BMF-Schreiben vom 22.12.2025 (Abschn. 10.1 Abs. 12 UStAE, 30-%-Getränkepauschale bei Kombiangeboten):
//  1. Pakete mit Speisen UND Getränken (auch package_type 'gruppenreisen'): 70 % Speisen zu 7 %, 30 % Getränke zu 19 %.
//  2. Pakete ausschließlich mit Speisen: vollständig 7 %. Kennzeichnung über die Paket-ID in FOOD_ONLY_PACKAGE_IDS;
//     ein unbekanntes (neues) Paket gilt als „mit Getränken“.
//  3. „Gesamte Location“: keine separate Raummiete, 70/30 wie 1.
//  4. Lieferkosten: 7 % als Nebenleistung einer reinen Speisenlieferung; sonst 19 % (siehe cateringDeliveryVatPercent).
//  5. Chafing Dish: separat buchbare Leihleistung, 19 % (Bruttopreis bleibt 25 EUR).
// Bruttobeträge ändern sich durch keine dieser Regeln, nur ihre Aufteilung auf die Steuersätze.

export const VAT_FOOD_PERCENT = 7;
export const VAT_STANDARD_PERCENT = 19;

/** Präfix der Warenkorb-/Bestellzeilen von Paketen (`event-<packages.id>`, auch für Gruppenreise-Pakete). */
export const PACKAGE_LINE_PREFIX = "event-";

/**
 * Pakete AUSSCHLIESSLICH mit Speisen (keine Getränke): vollständig 7 %.
 * Stand 27.11.2026 (Paketliste geprüft): genau die zwei „Candlelight Menü Sharing Edition“, includes leer, keine Getränke.
 * Neues Speisen-Paket ohne Getränke: hier die ID ergänzen. Alles, was hier fehlt, wird 70/30 geteilt.
 */
export const FOOD_ONLY_PACKAGE_IDS: readonly string[] = [
  "f4b3c534-2807-47b5-81bd-087a7650164a", // Candlelight Menü Sharing Edition, 78 EUR p. P.
  "5a434d47-d21a-4887-92a1-487e837d22d9", // Candlelight Menü Sharing Edition, 48 EUR p. P.
];

/** Paket-ID aus einer Zeilen-ID (`event-<id>`) oder einer reinen Paket-ID. */
export function packageIdOf(lineOrPackageId: string): string {
  return lineOrPackageId.startsWith(PACKAGE_LINE_PREFIX) ? lineOrPackageId.slice(PACKAGE_LINE_PREFIX.length) : lineOrPackageId;
}

/** Enthält das Paket Getränke (dann 70/30)? Unbekannte/fehlende IDs: ja. */
export function packageHasDrinks(lineOrPackageId: string | null | undefined): boolean {
  if (typeof lineOrPackageId !== "string" || lineOrPackageId === "") return true;
  return !FOOD_ONLY_PACKAGE_IDS.includes(packageIdOf(lineOrPackageId));
}

/** Zeilen-ID des Chafing-Dish-Leihgeräts (= CHAFING_DISH_ID in cateringPricing.ts und Checkout.tsx; Test prüft Gleichheit). */
export const CHAFING_LINE_ID = "chafing-dish";
export const CHAFING_VAT_PERCENT = VAT_STANDARD_PERCENT;

/** Steuersatz einer Catering-Zeile, die KEIN Paket ist: Chafing-Leihgerät 19 %, alle Speisen 7 %. */
export function cateringItemVatPercent(id: string | null | undefined): number {
  return id === CHAFING_LINE_ID ? CHAFING_VAT_PERCENT : VAT_FOOD_PERCENT;
}

/**
 * Steuersatz der Catering-Lieferkosten. 7 % nur, wenn die Lieferung Nebenleistung einer REINEN Speisenlieferung ist:
 * alle Zeilen sind Speisen (Catering-Menüs enthalten Stand 27.11.2026 keine Getränke), kein Chafing-Leihgerät
 * (eigenständige 19-%-Leistung, Entscheidung 5) und keine Geschenkkörbe in derselben Lieferung (Mischbestellung: Körbe mit
 * Wein/Feinkost fahren mit). Sonst bleibt es bei 19 % wie bisher.
 */
export function cateringDeliveryVatPercent(input: { itemIds: readonly string[]; hasGiftBaskets: boolean }): number {
  if (input.hasGiftBaskets) return VAT_STANDARD_PERCENT;
  if (input.itemIds.length === 0) return VAT_STANDARD_PERCENT;
  if (input.itemIds.some((id) => id === CHAFING_LINE_ID || id.startsWith(PACKAGE_LINE_PREFIX))) return VAT_STANDARD_PERCENT;
  return VAT_FOOD_PERCENT;
}
