
## Ziel

Die Positions-Zeilen innerhalb einer Section im **Freitext-Import-Editor** sollen exakt so aussehen und sich so anfühlen wie die Gang-Zeilen im **Eigenes-Menü-Editor** (Bild 2). Keine neue Funktionalität, keine neue Design-Sprache — nur Visual-Alignment auf das bestehende `InlineCourseEditor`-Pattern.

Zusätzlich: das in Bild 1 sichtbare `[object Object]`-Problem (alte DB-Daten, die in einer Textarea landen) endgültig wegmigrieren.

## Was geändert wird

**Nur eine Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformProgramEditor.tsx`
(Bereich: Section-Items innerhalb einer Mahlzeit, Zeilen ~492–552)

### Row-Layout (neu, 1:1 wie Eigenes Menü)

```text
[≡ drag]  [qty ×]  [Bezeichnung ......................]  [Preis] [/Pers. | pausch.]  [🗑]
```

Konkret pro Position:

1. **Drag-Handle** links (`GripVertical`, `cursor-grab`, `touch-none`) — rein kosmetisch, kein Reorder (Sections haben kein Sortable-Setup, also nur Optik passend zur Menü-Zeile, ohne dnd-kit hier einzuführen).
2. **Mengen-Input** (`h-9 w-14`, Zahl, rechtsbündig) + kleines „×".
3. **Bezeichnungs-Input** (`h-9 flex-1`) — bleibt einfaches Textfeld (kein DishPicker, keine neue Such-Funktion).
4. **Preis-Input** (`h-9 w-20`, rechtsbündig) für `unitPriceNet`.
5. **`LinePriceModeToggle`** mit Werten `per_person` / `flat` — gleiches Component wie im Menü-Editor.
   - `per_person` → Preis wird beim Total mit `quantity` multipliziert (heutiges Verhalten).
   - `flat` → Preis fließt als Pauschale ein (1 × Preis), unabhängig von Menge.
   - Default = `per_person` (entspricht heutigem Verhalten).
6. **Delete-Button** rechts (`Trash2`, hover destructive).

Sizes/Spacing/Abstände werden von `InlineCourseEditor` (`gap-2`, `h-9`, `rounded-md`) übernommen — die heutigen `h-7 text-xs`-Größen werden auf das Menü-Editor-Maß angehoben.

### Daten-Modell-Erweiterung (minimal)

`FreeformProgramSectionItem` bekommt **ein** zusätzliches Feld:

```ts
priceMode?: 'per_person' | 'flat'   // optional, default 'per_person'
```

`computeTotals` in `FreeformProgramEditor.tsx`:

```ts
const isFlat = it.priceMode === 'flat';
itemsSum += isFlat ? u : q * u;
```

Public-Offer-View (`FreeformProgramSection.tsx`) und `create-event-quotation` werden **nicht** umgebaut — sie rendern weiter `qty × name … total` (bei `flat` wird `total = unitPriceNet` statt `qty × unitPriceNet` benutzt, ein-Zeilen-Fix in der Total-Berechnung).

### Legacy-`[object Object]`-Fix

`normalizeFreeformItems` (in `FreeformImportPanel.tsx`) wird so erweitert, dass auch Items, die bereits Objekte sind aber zusätzlich irgendwo als `String(obj)` gelandet sind (z.B. wenn ein altes Editor-Save die `items.join("\n")`-Textarea persistiert hat), erkannt und in `{quantity, name, unitPriceNet}` migriert werden:

- Wenn `it` ein String ist und `"[object Object]"` enthält → ignorieren / leere Item-Liste lassen.
- Sonst Regex-Parser wie heute.

Die Editor-Hydration ruft `normalizeFreeformItems` schon beim Mount auf — dadurch verschwinden die `[object Object]`-Zeilen aus Bestandsdaten beim ersten Öffnen.

## Was bewusst NICHT geändert wird

- Keine neue DishPicker-/Suche-Funktion in Freitext.
- Kein Drag-and-Drop-Sortable für Positionen (nur kosmetischer Handle).
- Keine Änderung am Section-Header, an Mahlzeiten-Header, an Tagen, an Zusatzleistungen.
- Keine Änderung am Public-Offer-Layout über die Total-Zeile hinaus.
- Keine DB-Migration, kein Schema-Change in Supabase — `priceMode` ist optional und additiv im JSON.
- Edge Functions: `parse-freeform-offer` wird **nicht** angefasst (Default `per_person` reicht); `create-event-quotation` bekommt nur den 1-Zeilen-Total-Fix für `flat`.

## Validierung

1. Build muss grün bleiben (`tsgo`).
2. Bestandsanfrage öffnen, in der heute `[object Object]` steht → Editor zeigt leere/migrierte Positions-Zeilen, keine `[object Object]`-Strings mehr.
3. Neue Position hinzufügen, zwischen `/Pers.` und `pauschal` toggeln → Kalkulation unten reagiert korrekt (`q × u` bzw. `u`).
4. Visueller Vergleich Freitext-Section-Row vs. Eigenes-Menü-Gang-Row → gleiche Höhe, gleiche Abstände, gleiche Toggle-Optik.
