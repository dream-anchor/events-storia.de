

# Plan: Westwing-Pricing & Public-Offer-Anzeige fixen

## Befund (verifiziert mit DB + Code + LexOffice)

### Bug 1 — Falscher Bruttopreis 14.810,63 € in Maestro & Vorschau-Mail
**Ursache:** `useOfferBuilder.ts` Zeile 627 + 661:
```ts
const MENU_DISCOUNT = 0.25;
…
const discount = dishSubtotal * MENU_DISCOUNT;
```
Bei jedem `offer_mode='menu'` wird automatisch **25% Rabatt auf alle Course-Items** abgezogen — auch auf Equipment, Personal, Geschirr (die als `courseType:'starter'` gespeichert sind).

**Westwing-Daten in DB bestätigen den Bug:**
- Summe der `overridePrice`-Felder: 14.700 + 455 + 455 + 162,5 + 840 + 157,5 + 157,5 + 300 + 750 + 1.770 = **19.747,50 €** ✓
- DB-Wert `total_amount`: **14.810,63 €** = exakt 19.747,50 × 0,75 (= −25%)
- LexOffice-Quotation: **19.747,50 €** (korrekt, weil dort manuell überschrieben)

Die Vorschau-Mail erbt den falschen DB-Wert über `inquiry_offer_options.total_amount`.

### Bug 2 — Public-Offer zeigt keine Menü-Auswahl & keinen Zahl-Button
**Ursache:** `PublicOffer.tsx` Zeile 481 + 546:
```ts
const effectivePhase = … (phase === "draft" && status === "offer_sent" ? "final_sent" : phase);
{(effectivePhase === "proposal_sent" || previewBody !== null) && <ProposalView … />}
```
Westwing-DB: `offer_phase='draft'`, `status='new'` → `effectivePhase='draft'` → `<ProposalView>` rendert nicht.

Westwing wurde **nie über Maestro „versendet"** (kein `offer_slug`, kein `offer_sent_at`). Der Link existiert, aber die Auswahl-Karte ist by design unsichtbar im Draft-Status.

---

## Fix-Plan

### Fix 1 — Automatischen 25%-Menü-Rabatt entfernen
**Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts`

- `MENU_DISCOUNT = 0.25` → `0` (Zeile 627), Discount-Berechnung (Zeile 661) entfernen.
- Begründung: Maestro-Eingaben sind **immer Brutto-Endpreise** (Memory-Regel `lexoffice-gross-pricing`). Niemand erwartet, dass das System ungefragt 25% abzieht — schon gar nicht auf Equipment/Personal.
- Manuelle Rabatte bleiben verfügbar via `discountPercent`-Slider.

### Fix 2 — Westwing-DB-Wert korrigieren
- Nach Code-Fix: Westwing-Anfrage einmal in Maestro öffnen → Recalc-Effect aktualisiert `total_amount` automatisch auf 19.747,50 €.
- Vorschau-Mail zeigt dann den korrekten Brutto-Wert.

### Fix 3 — Westwing-Angebot offiziell versenden
**Kein Code-Fix nötig** — Madina muss in Maestro auf „Angebot senden" klicken:
- Setzt `offer_phase = 'proposal_sent'`
- Erzeugt `offer_slug` und `offer_sent_at`
- Public-Link zeigt dann Menü-Auswahl + Zahl-Button (`<ProposalView>` rendert)

### Memory-Update
Neue Memory-Regel `business/no-automatic-menu-discount`:
„Maestro-Preise sind immer Brutto-Endpreise. Es gibt keinen automatischen Rabatt — Rabatte ausschließlich explizit via `discountPercent`-Slider."

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` | `MENU_DISCOUNT = 0`; Discount-Block entfernen |
| `mem://business/no-automatic-menu-discount` | Neue Memory-Regel |

**Keine** DB-Migration. **Keine** Edge-Function-Änderungen. **Keine** PublicOffer-Änderungen (Verhalten ist korrekt — Westwing braucht nur „Angebot senden"-Klick).

---

## Erwartetes Ergebnis

1. **Maestro Westwing-Anzeige:** 19.747,50 € (korrekt) statt 14.810,63 €
2. **Künftige Anfragen im Menü-Modus:** kein Phantom-Rabatt mehr — angezeigter Brutto = Summe overridePrices
3. **Westwing Public-Offer:** wird funktional, sobald „Angebot senden" geklickt wird → ProposalView mit Menü-Liste + Zahl-Button erscheint
4. **LexOffice:** unverändert korrekt (19.747,50 € Brutto)

