
# Fix: Paketvorauswahl korrekt anzeigen und berechnen

## Problem

Wenn ein Kunde bei der Anfrage ein Paket ausgewählt hat (z.B. "Business Dinner – Exclusive"), wird dieses zwar beim Initialisieren gesetzt, aber:
1. Das Dropdown zeigt es nicht korrekt an, weil `totalAmount` = 0 ist
2. Der Preis wird nicht berechnet
3. `selectedPackages` fehlt in den useEffect-Dependencies

## Lösung

Im `useMultiOfferState.ts` Hook bei der Initialisierung auch den Preis berechnen und den Paketnamen setzen.

## Technische Änderungen

### Datei: `src/components/admin/refine/InquiryEditor/MultiOffer/useMultiOfferState.ts`

**Zeilen 57-64 ändern:**

```typescript
} else {
  // Create initial option A - pre-fill with customer's selected package if available
  const customerPackage = selectedPackages?.[0];
  const customerPackageId = customerPackage?.id || null;
  
  // Calculate initial total if package is selected
  let initialTotal = 0;
  let initialPackageName = '';
  
  if (customerPackage) {
    // Try to get price info from selected_packages data
    // The selected_packages array contains full package info from cart
    const pkgData = customerPackage as { 
      id: string; 
      name?: string; 
      price?: number; 
      pricePerPerson?: boolean;
    };
    
    initialPackageName = pkgData.name || '';
    if (pkgData.price) {
      initialTotal = pkgData.pricePerPerson 
        ? pkgData.price * guestCount 
        : pkgData.price;
    }
  }
  
  setOptions([{
    id: crypto.randomUUID(),
    ...createEmptyOption('A', guestCount),
    packageId: customerPackageId,
    packageName: initialPackageName,
    totalAmount: initialTotal,
  }]);
}
```

**Dependency Array erweitern (Zeile 94):**

```typescript
}, [inquiryId, guestCount, selectedPackages]);
```

## Ergebnis

- Das vom Kunden gewählte Paket erscheint sofort im Dropdown als ausgewählt
- Der Preis wird automatisch auf Basis der Gästezahl berechnet
- Der Paketname wird in der Option gespeichert
