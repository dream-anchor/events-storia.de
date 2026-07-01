
# Freitext-Import → Standard-Menü-Wizard mit Tages-Tabs

## Ziel
Der Freitext-Import erzeugt **exakt dasselbe Datenmodell und dieselbe UI** wie ein handgemachtes Menü. Der einzige Unterschied: bei mehrtägigen Angeboten sitzt ein Tages-Wahl-Header über dem Wizard, der zwischen den Tages-Menüs umschaltet. Bei 1 Tag ist der Header unsichtbar — 100 % identisch zum Handmenü.

Als Nebeneffekt verschwinden die im Audit vom letzten Turn gefundenen Freeform-Bugs (Fake-Content, Preis-Overwrite, unsichtbare Per-Person-Preise & Zusatzleistungen), weil das zweite Datenmodell komplett wegfällt.

---

## Datenmodell

### Neu: `menuSelection.days[]`
```ts
interface MenuDay {
  id: string;
  dateLabel: string;       // "Mo 29.06." — leer bei 1-Tages-Menü
  isoDate?: string | null;
  mealLabel?: string;      // "Lunch" / "Dinner" — optional
  guestCount?: number;     // pro Tag überschreibbar, sonst option.guestCount
  courses: CourseSelection[];   // identisch zum Handmenü-Schema
  // Getränke/Equipment/Staff bleiben auf option-Ebene (gelten für alle Tage)
}
```

`menuSelection.courses` bleibt als **Legacy-Feld** bestehen und wird bei Load automatisch in `days[0].courses` migriert. Neue Handmenüs schreiben sofort in `days: [{ id, dateLabel: '', courses: [...] }]`. So gibt es intern nur einen Pfad.

### `freeformProgram` bleibt vorerst
Wird beim Öffnen einer Alt-Anfrage einmalig in `days[]` gemappt (Migrationshelfer im Client) und danach nicht mehr geschrieben. Nach Verifikation im Betrieb kann `freeformProgram` in einer späteren Session ganz entfernt werden.

---

## UI

### OptionCard (Admin)
```
┌──────────────────────────────────────────────────────────────┐
│ [Mo 29.06. Lunch] [Mo 29.06. Dinner] [Di 30.06. Lunch] …  + │  ← Tabs (nur wenn days.length > 1)
├──────────────────────────────────────────────────────────────┤
│ Tages-Metadaten: Label │ Datum │ Gäste │ 🗑                   │  ← klein, nur bei Multi-Day
├──────────────────────────────────────────────────────────────┤
│ ← unveränderter MenuComposer (Gänge, Getränke-Sektion) →     │
└──────────────────────────────────────────────────────────────┘
```

- Neue Komponente `DayTabsBar` (Tab-Buttons + „+ Tag hinzufügen" + Reorder via Drag).
- Der bestehende `MenuComposer` bekommt `courses` und `onCoursesChange` als Props (heute schon so) und wird pro aktivem Tag gemounted — kein UI-Umbau am Wizard selbst.
- Bei `days.length === 1` UND `dateLabel === ''` werden Tabs + Tages-Metadaten-Zeile ausgeblendet → visuell identisch zum heutigen Handmenü.

### Public Offer
`FreeformProgramSection.tsx` wird gelöscht. Der Public-Offer-Renderer rendert `menuSelection.days[]` mit der bestehenden Menü-Rendering-Logik, umschlossen von einem `<section>` pro Tag (Datum als H4-Header). Bei 1 Tag / leerem Label kein Header → identisch zum heutigen Handmenü-Rendering.

Zusatzleistungen (Personal €/h, Anfahrt) werden als eigener Block unter allen Tagen gerendert — analog zu `equipment`/`staff` beim Handmenü. Kalkulation (Speisen-Netto, Services-Netto, Gesamt brutto) bleibt sichtbar, wird aber aus den Tagen zusammengerechnet (siehe Preislogik).

---

## Parser-Umbau

`supabase/functions/parse-freeform-offer/index.ts`:

- **Tool-Schema neu**: statt `days[].meals[].sections[].items[]` liefert die KI direkt `days[].courses[]` mit `{ courseType, courseLabel, itemName, itemDescription, overridePrice, quantity, priceMode }` — identisch zum handgemachten `CourseSelection`. Dazu `days[].dateLabel`, `days[].mealLabel`, `days[].guestCount` sowie `additionalServices[]` und `discount`.
- Prompt strikt: „Übernimm Preise 1:1, niemals rechnen. Fehlende Werte = 0 oder leerer String. NIEMALS erfinden."
- Menu-Lookup (`enrichItemsFromMenu`) wird konservativ: nur `itemId` und `itemDescription` aus DB nachladen wenn Name exakt matched. **Preis und Name aus dem Text bleiben unantastbar.** Behebt Audit-Finding #1.
- Alle deterministischen Client-Fallbacks (`extractMealSectionsFromText`, hartcodierte „Aperitivo mit italienischen Appetizern"-Strings, `backfillEmptyMeals`) werden ersatzlos gelöscht. Behebt Audit-Findings #2.
- Input-Cap: 25 000 Zeichen → HTTP 400.

Validator (`validate-freeform-offer`) wird auf das neue Schema angepasst; Enum um `additional_services` erweitert.

---

## Preislogik

`useOfferBuilder.ts` bekommt einen einzigen Recalc-Pfad für `offerMode === 'menu'`:

```
totalAmount =
    Σ über alle days[]:
        Σ course.overridePrice × (course.quantity ?? 1) × (priceMode==='flat' ? 1 : guests)
  + Getränke-Summe (unverändert)
  + Equipment/Staff (unverändert)
  + Σ additionalServices[] wo quantity gesetzt (unit × qty)
  − discount
```

`freeformProgram.totalsFromText` wird nur noch als Sanity-Check angezeigt („KI-Text sagte 12 450 € brutto — berechnet: 12 380 €. Abweichung prüfen?"), fließt aber nicht mehr in `totalAmount`. Behebt Audit-Finding #5.

---

## Migrationsschritte (Reihenfolge)

1. **Types + Migrations-Helper** (`OfferBuilder/types.ts`, neue `hydrateToDays()`): `MenuDay` einführen, `menuSelection.days` optional, alte `courses` bleiben. `useOfferBuilder` Load-Phase migriert Alt-Daten in-memory (kein DB-Write nötig — Persistenz via next Save).
2. **DayTabsBar** + Integration in `OptionCard.tsx` (`MenuContent`). Bei 1 Tag: Tabs versteckt.
3. **Recalc-Umbau** in `useOfferBuilder.ts` — iteriert über `days[]` statt `courses[]`.
4. **Parser + Prompt umbauen** — liefert `days[].courses[]` + `additionalServices[]`.
5. **Client-Import-Panel** aufräumen: alle deterministischen Fake-Sections/Bullet-Backfill raus. Ergebnis wird direkt in `menuSelection.days[]` gemerged, `offerMode='menu'` gesetzt (nicht mehr `freeform`).
6. **Public Offer**: `FreeformProgramSection.tsx` durch Tages-Loop um bestehende Menü-Rendering-Komponente ersetzen. Zusatzleistungen-Block ergänzen.
7. **Freeform-Hydration**: Alt-Anfragen mit `freeformProgram` beim Load in `days[]` mappen — sichtbar identisch zu neuen Importen.
8. **Regressionstest** manuell: bestehende Anfrage mit Freeform-Daten öffnen, neuer Freitext-Import (1 Tag + Mehrtag), Handmenü, jeweils Public-Offer-Preview.

Kein DB-Migration nötig — `menu_selection` ist JSONB. Alt-Datensätze werden read-side migriert.

---

## Aus-Scope (bewusst weggelassen)
- PDF-Renderer für Tages-Gruppierung (kann als Follow-up, sobald neue Struktur live ist).
- Vollständiges Löschen von `freeformProgram`-Feld — erst nach 1–2 Wochen Betrieb.
- Rückwirkende DB-Migration der Alt-Anfragen — passiert automatisch beim ersten Save nach Bearbeitung.

---

## Aufwand
Ca. 2 Build-Sessions:
- Session 1: Schritte 1–3 + 7 (Datenmodell, DayTabsBar, Recalc, Alt-Daten-Hydration) — Handmenü und Alt-Freeform funktionieren wie bisher, aber intern über `days[]`.
- Session 2: Schritte 4–6 + 8 (Parser, Public Offer, Testrunde).

Sag mir „go Session 1" und ich starte mit dem Datenmodell + DayTabsBar.
