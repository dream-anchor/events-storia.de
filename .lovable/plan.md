
## Equipment & Personal im OfferBuilder

Zwei neue Sektionen unterhalb der Getränke in jeder Angebotsoption (Menu, Paket, Email-Modus). Der Admin gibt manuell Zeilen ein (Name, Preis, Menge). Beide erscheinen als eigene Positionen auf dem LexOffice-Angebot/Rechnung mit 19% MwSt.

---

### 1. Datenmodell erweitern (kein DB-Change nötig)

`menu_selection` (JSONB) wird um zwei Arrays erweitert:

```typescript
interface EquipmentItem {
  id: string;
  name: string;
  pricePerUnit: number;  // Brutto
  quantity: number;
}
```

Neue Felder in `OfferBuilderOption.menuSelection`:
- `equipment: EquipmentItem[]`
- `staff: EquipmentItem[]` (gleiche Struktur)

Kein DB-Migrations nötig — alles lebt im bestehenden JSONB-Feld `menu_selection`.

### 2. Type-System aktualisieren

**MenuComposer/types.ts**: `EquipmentItem` Interface + Export.

**OfferBuilder/types.ts**: `menuSelection` um `equipment?` und `staff?` erweitern.

### 3. Neue UI-Komponente: `InlineServiceEditor`

Wiederverwendbare Komponente für beide Sektionen (Equipment + Personal). Gleiche Inline-Edit-UX wie `DrinkSection` im Einzeln-Modus:
- Zeile: Name (Freitext) | Preis (€) | Menge (Zahl) | Löschen-Button
- "+" Button zum Hinzufügen neuer Zeilen
- Sektionsheader: "Equipment" bzw. "Personal" mit Icon (Wrench / Users)

### 4. OptionCard.tsx: Sektionen einbinden

In `MenuContent` und `PaketContent` nach der DrinkSection:
1. Equipment-Sektion (`InlineServiceEditor`)
2. Personal-Sektion (`InlineServiceEditor`)

Im Email-Modus ebenfalls verfügbar (Equipment/Personal können auch ohne Menü relevant sein).

### 5. PriceBreakdown.tsx: Positionen anzeigen

Equipment- und Personal-Summen separat im Preisüberblick auflisten.

### 6. LexOffice Edge Function: Positionen als Rechnungszeilen

**create-event-quotation/index.ts**: In `buildLineItems()`:
- Equipment-Array → je eine Zeile mit 19% MwSt, `unitName: 'Stk'`
- Staff-Array → je eine Zeile mit 19% MwSt, `unitName: 'Stk'`

Gilt für beide Modi (`per_person` und `per_event`).

### 7. Total-Berechnung

Equipment- und Personal-Summen fließen in `totalAmount` ein. Die Berechnung im `useOfferBuilder` Hook wird entsprechend erweitert.

---

### Dateien die geändert werden

| Datei | Änderung |
|---|---|
| `src/components/admin/refine/InquiryEditor/MenuComposer/types.ts` | `EquipmentItem` Interface |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/types.ts` | menuSelection erweitern |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx` | **Neu** — wiederverwendbare Komponente |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx` | Equipment/Personal Sektionen einbinden |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/PriceBreakdown.tsx` | Summen anzeigen |
| `supabase/functions/create-event-quotation/index.ts` | LexOffice-Zeilen für Equipment/Personal |
