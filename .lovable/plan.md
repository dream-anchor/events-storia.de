
# Plan: Staffelpreis für "Gesamte Location" Paket

## Geschäftslogik

Das Paket "Gesamte Location" hat ein spezielles Preismodell:

| Gästeanzahl | Preis |
|-------------|-------|
| 70 Personen (Basis) | 8.500 € |
| 71 Personen | 8.621,43 € (+121,43 €) |
| 80 Personen | 9.714,30 € (+1.214,30 €) |
| 100 Personen | 12.142,90 € (+3.642,90 €) |

**Formel:** `Preis = 8.500 € + max(0, guestCount - 70) × (8.500 / 70)`

Der Aufpreis pro zusätzliche Person beträgt **121,43 €** (gerundet: 8.500 / 70).

---

## Technische Umsetzung

### Zentrale Preisberechnungsfunktion

Eine neue Utility-Funktion wird erstellt, die an allen relevanten Stellen verwendet wird:

```text
src/lib/eventPricing.ts (NEU)
```

```typescript
// Package ID für "Gesamte Location" 
const LOCATION_PACKAGE_ID = 'b147ea52-9907-445f-9f39-b7ddecbb0ddf';

// Basis-Konfiguration
const LOCATION_BASE_PRICE = 8500;
const LOCATION_BASE_GUESTS = 70;
const PRICE_PER_EXTRA_GUEST = LOCATION_BASE_PRICE / LOCATION_BASE_GUESTS; // 121.43€

export function calculateEventPackagePrice(
  packageId: string,
  basePrice: number,
  guestCount: number,
  pricePerPerson: boolean
): number {
  // Standard per-person Pakete (Network-Aperitivo, Business Dinner)
  if (pricePerPerson) {
    return basePrice * guestCount;
  }
  
  // Spezialfall: "Gesamte Location" mit Staffelpreis
  if (packageId === LOCATION_PACKAGE_ID || 
      basePrice === LOCATION_BASE_PRICE) {
    const extraGuests = Math.max(0, guestCount - LOCATION_BASE_GUESTS);
    return LOCATION_BASE_PRICE + (extraGuests * PRICE_PER_EXTRA_GUEST);
  }
  
  // Andere Pauschalpakete: fester Preis
  return basePrice;
}

export function isLocationPackage(packageId: string, price?: number): boolean {
  return packageId === LOCATION_PACKAGE_ID || price === LOCATION_BASE_PRICE;
}
```

---

## Dateien die geändert werden

### 1. `src/lib/eventPricing.ts` (NEU)
Zentrale Preisberechnungs-Utility mit der Staffelpreis-Logik.

### 2. `src/components/events/EventPackageShopCard.tsx`
- Import der neuen `calculateEventPackagePrice` Funktion
- Ersetze Zeile 62: `const totalPrice = pkg.price_per_person ? pkg.price * guestCount : pkg.price;`
- Mit: `const totalPrice = calculateEventPackagePrice(pkg.id, pkg.price, guestCount, !!pkg.price_per_person);`
- Zeige dynamischen Gesamtpreis auch für das Location-Paket an (nicht nur bei `price_per_person`)
- Aktualisiere den `handleAddToCart` um den berechneten Einzelpreis zu übergeben

### 3. `src/contexts/CartContext.tsx`
- Import der neuen Utility
- Erweitere `CartItem` Interface um optionale Felder für Event-Pakete:
  - `isEventPackage?: boolean`
  - `baseGuestCount?: number` (Basis für Staffelpreis)
- Passe `totalPrice` Berechnung an, um die Staffellogik zu berücksichtigen

### 4. `src/components/cart/CartSheet.tsx`
- Verwende die neue Preisberechnungsfunktion für die Anzeige
- Zeige bei Location-Paket einen Hinweis: "8.500 € Basis + X Pers. × 121,43 €"

### 5. `src/pages/Checkout.tsx`
- Verwende dieselbe Berechnungslogik für die Checkout-Summen
- Stelle sicher, dass der korrekte Preis an Stripe übergeben wird

---

## UI-Anpassungen im EventPackageShopCard

**Vorher (Zeilen 200-210):**
Zeigt Gesamtpreis nur bei `price_per_person`

**Nachher:**
Zeigt immer einen dynamischen Gesamtpreis wenn er vom Basispreis abweicht:

```tsx
{/* Total Price - for per-person OR tiered pricing */}
{(pkg.price_per_person || (totalPrice !== pkg.price)) && (
  <div className="text-center">
    <span className="text-base text-muted-foreground">
      {language === 'de' ? 'Gesamt:' : 'Total:'} 
    </span>
    <span className="text-xl font-bold text-primary ml-2">
      {formatPrice(totalPrice)}
    </span>
    {/* Explanation for tiered pricing */}
    {!pkg.price_per_person && totalPrice > pkg.price && (
      <p className="text-xs text-muted-foreground mt-1">
        {language === 'de' 
          ? `Basis 8.500 € + ${guestCount - 70} Pers. × 121,43 €`
          : `Base €8,500 + ${guestCount - 70} guests × €121.43`}
      </p>
    )}
  </div>
)}
```

---

## Preisanzeige im Warenkorb

Für das Location-Paket wird die Berechnung transparent dargestellt:

```text
Gesamte Location
80 Gäste
8.500 € + 10 × 121,43 € = 9.714,30 €
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/lib/eventPricing.ts` | NEUE Datei mit Staffelpreis-Logik |
| `src/components/events/EventPackageShopCard.tsx` | Nutzt neue Berechnungsfunktion |
| `src/contexts/CartContext.tsx` | Erweiterte Preisberechnung für Staffelpreise |
| `src/components/cart/CartSheet.tsx` | Transparente Preisdarstellung |
| `src/pages/Checkout.tsx` | Korrekte Summenberechnung |

Die Änderung ist rückwärtskompatibel – alle anderen Pakete (Network-Aperitivo, Business Dinner) funktionieren weiterhin unverändert.
