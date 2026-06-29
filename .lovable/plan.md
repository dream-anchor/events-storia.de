## Ziel

Im Freitext-Import (KI) jede Zeile innerhalb eines Abschnitts (z.B. „Pizzen", „Salate") als **eigene Position mit Anzahl + Preis** behandeln — analog zu „Eigenes Menü" / anderen Wizards (`InlineCourseEditor`). Keine neue Optik, kein neues Konzept; nur dort umbauen, wo es technisch nötig ist.

## Aktueller Zustand

`FreeformProgramSection.items` ist `string[]` (Plain‑Text‑Zeilen wie „2 × Pizza Margherita"). Preis liegt nur **pro Mahlzeit** (Pauschal oder €/Pers.) — pro Einzelgericht gibt es weder Menge noch Preis.

## Änderungen

### 1. Typ erweitern — `OfferBuilder/types.ts`
```ts
export interface FreeformProgramSectionItem {
  quantity: number;          // Stück / Portionen
  name: string;
  unitPriceNet: number;      // € pro Stück
}
export interface FreeformProgramSection {
  heading?: string | null;
  items: FreeformProgramSectionItem[];   // statt string[]
}
```

### 2. Editor — `FreeformProgramEditor.tsx`
- Section‑`Textarea` → Liste von Zeilen mit denselben Controls wie `InlineCourseEditor` (Drag‑Handle entfällt — nur Reihenfolge per Hinzu/Entfernen), pro Zeile: `Menge ×` | `Name` (Input flex‑1) | `€` (Preis netto) | `X` (entfernen). + „Position hinzufügen"-Button (klein, Ghost) unterhalb.
- `computeTotals`: Speisen‑Netto = Σ aller `quantity × unitPriceNet` aller Items **plus** weiterhin `flatPriceNet` und `pricePerPersonNet × guestCount` der Mahlzeit (damit Pauschal-/Pro‑Person‑Felder weiter funktionieren, falls genutzt).

### 3. Migration / Parser — `FreeformImportPanel.tsx` + KI‑Prompt
- Bestehende `string[]`‑Items beim Laden migrieren: Zeile parsen mit Regex `^(\d+)\s*[×x]\s*(.+?)(?:\s+([\d.,]+)\s*€)?$` → `{quantity, name, unitPriceNet}` (Preis 0, wenn keiner im Text).
- KI‑Import‑Prompt um Preise pro Zeile erweitern (Pflichtfeld `unitPriceNet`, default 0). Antwort‑Schema entsprechend anpassen.
- Validierungs‑Findings unverändert.

### 4. Anzeige — `src/pages/public-offer/FreeformProgramSection.tsx` + `ProposalView.tsx` (falls dort gerendert)
- Items‑Render von `<li>{string}</li>` auf `{qty} × {name}` umstellen; wenn `unitPriceNet > 0`: rechtsbündig `… €` (Brutto‑Anzeige analog Menü‑Wizard, da Maestro = Single Source of Truth → keine Neuberechnung, nur Anzeige des Netto‑Preises wie bisher im Wizard).

### 5. Persistenz
Keine DB‑Migration nötig — `menu_selection.freeformProgram` ist JSONB. Der erweiterte Typ wird beim nächsten Save geschrieben; alte Daten werden beim Laden einmalig migriert (Schritt 3).

## Nicht ändert

- Kein neues Design, keine Drag&Drop‑Sortierung, keine neuen Buttons außer „Position hinzufügen".
- Mahlzeit‑Header (Personen, Pauschal, €/Pers., MwSt) bleibt 1:1.
- Zusatzleistungen, Kalkulation, Rabatt, Findings: unverändert.
- LexOffice‑/Stripe‑Pfade: unverändert (Totals werden weiterhin aus `totalsFromText`/`taxBreakdown` gelesen, die jetzt auch Item‑Summen enthalten).

## Verifikation

1. Bestehende Anfrage mit Freitext‑Import öffnen → alte `string[]`‑Items erscheinen migriert als Zeilen mit Menge & Name, Preis 0.
2. Neuen Import via KI ausführen → Preise pro Zeile gefüllt, Speisen‑Netto in Kalkulation aktualisiert sich live.
3. Public‑Offer‑Vorschau (`/offer/<slug>`) → Items werden inkl. Menge und (falls vorhanden) Preis angezeigt.
4. Build (`tsgo`) grün.

## Betroffene Dateien

- `src/components/admin/refine/InquiryEditor/OfferBuilder/types.ts`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformProgramEditor.tsx`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformImportPanel.tsx`
- `src/pages/public-offer/FreeformProgramSection.tsx`
- `src/pages/PublicOffer.tsx` / `src/pages/public-offer/ProposalView.tsx` (nur falls dort Items gerendert werden)
