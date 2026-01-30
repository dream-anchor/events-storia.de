
# Plan: Lieferadresse & abweichende Rechnungs-/Firmenadresse im Checkout

## Aktuelle Situation

Der Checkout hat bereits:
- **Lieferadresse** in Sektion 1 (Straße, PLZ, Stadt, Stockwerk)
- **Rechnungsadresse** in Sektion 2, aber nur bei Lieferung sichtbar
- **Firma** als optionales Feld in den Kundendaten

## Änderungen nach Amazon-Logik

### 1. Rechnungsadresse auch bei Abholung verfügbar machen

Die Checkbox "Rechnungsadresse gleich Lieferadresse" wird derzeit nur bei `deliveryType === 'delivery'` angezeigt. Bei Abholung soll der Kunde ebenfalls eine Rechnungsadresse eingeben können.

**Lösung:** Den Billing-Bereich aus der `deliveryType === 'delivery'` Bedingung herauslösen und immer anzeigen.

### 2. Klarere Bezeichnungen (Amazon-Stil)

- Bei **Lieferung**: "Rechnungsadresse gleich Lieferadresse"
- Bei **Abholung**: "Abweichende Rechnungsadresse?" (da es keine Lieferadresse gibt)

### 3. Formular-Logik anpassen

Bei Abholung soll die Rechnungsadresse standardmäßig mit den Kontaktdaten (Name) vorausgefüllt werden, aber der Kunde kann eine andere Firmenadresse wählen.

---

## Technische Umsetzung

### Datei: `src/pages/Checkout.tsx`

#### Änderung 1: Billing-Sektion immer anzeigen (Zeilen ~1446-1481)

```tsx
// VORHER: {formData.deliveryType === 'delivery' && (...)}
// NACHHER: Immer anzeigen, aber Label anpassen

<div className="mt-6 pt-4 border-t border-border">
  <div className="flex items-center space-x-2 mb-4">
    <Checkbox
      id="sameAsDelivery"
      checked={formData.sameAsDelivery}
      onCheckedChange={(checked) => setFormData(prev => ({ 
        ...prev, 
        sameAsDelivery: checked === true 
      }))}
    />
    <Label htmlFor="sameAsDelivery" className="font-normal cursor-pointer">
      {formData.deliveryType === 'delivery'
        ? (language === 'de' 
            ? 'Rechnungsadresse gleich Lieferadresse' 
            : 'Billing same as delivery')
        : (language === 'de' 
            ? 'Keine abweichende Rechnungsadresse' 
            : 'No separate billing address')
      }
    </Label>
  </div>
  
  {!formData.sameAsDelivery && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Billing fields: Name/Firma, Straße, PLZ, Stadt */}
    </div>
  )}
</div>
```

#### Änderung 2: Billing-Adresse-Logik im Submit anpassen (Zeilen ~730-745)

Die `billingAddress`-Logik muss bei Abholung anders gehandhabt werden:
- Bei Abholung + `sameAsDelivery=true`: Kontaktdaten (Name, evtl. Firma) verwenden
- Bei Abholung + `sameAsDelivery=false`: Die eingegebene Billing-Adresse verwenden

```tsx
const billingAddress = {
  name: !formData.sameAsDelivery && formData.billingName 
    ? formData.billingName 
    : (formData.company || formData.name),
  street: !formData.sameAsDelivery 
    ? formData.billingStreet 
    : (formData.deliveryType === 'delivery' ? formData.deliveryStreet : ''),
  zip: !formData.sameAsDelivery 
    ? formData.billingZip 
    : (formData.deliveryType === 'delivery' ? formData.deliveryZip : ''),
  city: !formData.sameAsDelivery 
    ? formData.billingCity 
    : (formData.deliveryType === 'delivery' ? formData.deliveryCity : ''),
  country: formData.billingCountry || 'Deutschland'
};
```

---

## Visueller Flow (Amazon-Stil)

```text
┌─────────────────────────────────────────────────┐
│ SEKTION 2: Kundendaten                          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name *           │  E-Mail *                   │
│  ________________ │  ______________________     │
│                                                 │
│  Telefon *        │  Firma (optional)           │
│  ________________ │  ______________________     │
│                                                 │
├─────────────────────────────────────────────────┤
│  ☑ Keine abweichende Rechnungsadresse          │
│     (bzw. "Rechnungsadresse = Lieferadresse")  │
│                                                 │
│  Wenn deaktiviert:                              │
│  ┌───────────────────────────────────────────┐ │
│  │ Rechnungsempfänger (Name/Firma) *         │ │
│  │ Straße und Hausnummer *                   │ │
│  │ PLZ *              │ Stadt *              │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Änderungen

| Bereich | Änderung |
|---------|----------|
| Billing-Sektion | Immer anzeigen (nicht nur bei Lieferung) |
| Checkbox-Label | Dynamisch je nach Liefer-/Abholmodus |
| Submit-Logik | Bei Abholung: Kontaktdaten als Fallback für Billing |
| UX | Amazon-Stil: Klare Checkbox, aufklappbare Details |

Die Änderungen betreffen nur **eine Datei** (`src/pages/Checkout.tsx`) und umfassen ca. 15-20 Zeilen Code-Anpassungen.
