Maestro und Kunden-Angebot zeigen die MwSt. aktuell nicht aus und beschriften die Brutto-Summe fälschlich als „Netto gesamt“. Ich passe das an zwei Stellen an.

## Änderungen

### 1. Maestro Preis-Breakdown (`PriceBreakdown.tsx`)
- Alle Positionspreise sind Brutto-Endpreise (Maestro = Single Source of Truth). Das wird in den Labels explizit klargestellt:
  - „Zwischensumme gesamt“ bleibt — ist bereits Brutto.
  - „Netto gesamt“ (nach Rabatt) wird zu „Gesamt brutto“.
  - „Errechnet gesamt“ / „Angebotspreis gesamt“ bleiben — sind die finalen Brutto-Endpreise.
- Neue MwSt-Ausweisung direkt unter dem Brutto-Gesamtbetrag, analog zum LexOffice-Beleg:
  - Speisen 7 % (Kurse): `enthaltene USt 7 %: x,xx €`
  - Getränke/Equipment/Personal 19 %: `enthaltene USt 19 %: x,xx €`
  - „darin enthalten“-Hinweis, weil Maestro-Preise immer Brutto sind.
- Die Splitting-Logik nutzt dieselben Steuersatz-Regeln wie die Edge-Function (`FOOD_TAX_RATE` 7 %, `DRINK_TAX_RATE` 19 %).
- Keine Änderung an Preisberechnung, gespeicherten Werten oder Rabattlogik — nur Darstellung und Labels.

### 2. Kunden-Angebot (Public Offer Views)
- In den Kunden-sichtbaren Ansichten (`PublicOffer.tsx`, `public-offer/FinalOfferView.tsx`, `public-offer/ProposalView.tsx`) wird unter dem Gesamtbetrag derselbe MwSt-Hinweis angezeigt:
  - „Im Gesamtbetrag von X,XX € sind enthalten: USt 7 % (a,aa €), USt 19 % (b,bb €).“
- Berechnung erfolgt 1:1 aus den vorhandenen `menu_selection`-Daten je Option (gleiche Steuersatz-Zuordnung wie Edge-Function).
- Wenn nur ein Steuersatz vorkommt (z. B. reines Catering ohne Getränke), wird nur dieser angezeigt.

## Nicht geändert
- Edge-Function `create-event-quotation` und LexOffice-PDF — die zeigen MwSt. bereits korrekt.
- Datenbank, Migrationen, gespeicherte Preise.
- Rabatt- oder Berechnungslogik.