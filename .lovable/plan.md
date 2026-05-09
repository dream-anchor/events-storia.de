## Problem

Beim Paket „Gesamte Location" (Pauschal-Paket, `price_per_person = false`) trägst du oben **1.000 €** ein. Das soll der **Gesamtpreis** sein. Tatsächlich passiert aber:

1. Feld ist mit „**Preis/Person:**" beschriftet → falsche Erwartungshaltung.
2. Anzeige rechnet `1.000 × 20 Gäste = 20.000,00 € gesamt` → falsch bei Pauschalen.
3. Preisaufstellung unten zeigt zusätzlich den Katalogpreis **8.500 €** + Tier-Breakdown → widersprüchlich.
4. `useOfferBuilder.ts` (Zeile 715) multipliziert bei `pricingMode='per_person'` ebenfalls `budgetPerPerson × guestCount` → falscher Versand-Total.

Der Bug liegt darin, dass das Feld in **allen** Fällen wie ein Per-Person-Wert behandelt wird, obwohl das Paket pauschal abgerechnet wird.

## Logik (zukünftig korrekt)

Das Eingabefeld **respektiert den Pakettyp**:

| Pakettyp | Feld-Label | Bedeutung des Wertes | Total-Berechnung |
|---|---|---|---|
| `price_per_person = true` (z. B. Network-Aperitivo) | „Preis/Person" | Preis pro Gast | `Wert × Gäste` |
| `price_per_person = false` (z. B. Gesamte Location) | „Gesamtpreis" | Gesamtpreis für den Anlass | `Wert` (keine Multiplikation) |

Sobald ein Override gesetzt ist, **ersetzt er den Katalog vollständig** — Tier-Breakdown („Basis bis 70 Gäste …") und 8.500 €-Anzeige verschwinden.

## Änderungen

**1. `OptionCard.tsx` (Zeile 704–723) — Eingabefeld**
- Label dynamisch: `selectedPkg.price_per_person ? 'Preis/Person:' : 'Gesamtpreis:'`.
- Hinweis-Text rechts dynamisch:
  - per-Person: `= {Wert × Gäste} € gesamt`
  - Pauschal: `= {Wert / Gäste} € pro Person` (rein informativ, klein, grau)
- Placeholder bleibt der Katalogpreis.

**2. `OptionCard.tsx` — `effectivePackage` (Zeile 132–143)**
- Override unabhängig von `price_per_person` anwenden.
- Markierung `__priceOverridden: true` setzen, damit `PriceBreakdown` weiß: kein Tier, kein Katalog.
- `price` wird auf den Override gesetzt; `price_per_person` bleibt unverändert (damit die Multiplikations-Logik in `PriceBreakdown` weiterhin korrekt entscheidet).

**3. `PriceBreakdown.tsx` (Paket-Modus, Zeile 363–420)**
- Wenn `__priceOverridden`:
  - Kein Aufruf von `calculateEventPackagePrice`. Stattdessen:
    - per-Person: `locationTotal = override × guestCount`, Anzeige `({Gäste} × {override})`.
    - Pauschal: `locationTotal = override`, Anzeige nur Paket-Name + Total.
  - Tier-Breakdown wird **nicht** gerendert.
- Ohne Override: Verhalten unverändert.

**4. `useOfferBuilder.ts` (Zeile 705–722) — Total-Berechnung**
- Wenn `budgetPerPerson` gesetzt **und** Paket `price_per_person = false`:
  - `newTotal = budgetPerPerson + courseSurcharge × guestCount` (Pauschale, keine Multiplikation am Override).
- Wenn `budgetPerPerson` gesetzt **und** Paket `price_per_person = true`:
  - Verhalten wie heute (`budgetPerPerson × guestCount + …`).
- Bei `pricingMode='per_event'`: Override ist sowieso schon der Gesamtpreis (heute korrekt).
- Cache-Key (Zeile 755) bleibt unverändert.

**5. Datenmodell — keine Änderung**
- Keine Migration. `budgetPerPerson` bleibt als Spaltenname (semantisch jetzt „Override-Wert", nicht zwingend per Person). Umbenennung wäre invasiv und versendete Angebote sollen unverändert bleiben.

## Smoke-Test

1. **Pauschal-Paket „Gesamte Location"**, 20 Gäste, Override `1000` →
   - Label = „Gesamtpreis"; Hinweis = „= 50,00 € pro Person".
   - Aufstellung: nur „Gesamte Location — 1.000,00 €". Kein 8.500 €, kein Tier.
   - Errechnet gesamt = 1.000 €. Versendetes `totalAmount` = 1.000 €.
2. **Per-Person-Paket „Network-Aperitivo"**, 20 Gäste, Override `45` →
   - Label = „Preis/Person"; Hinweis = „= 900,00 € gesamt".
   - Aufstellung: „Network-Aperitivo (20 × 45,00 €) — 900,00 €".
3. Override leeren (Pauschal) → Tier + Katalog 8.500 € kehren zurück.
4. Rabatt 10 % auf Pauschal-Override 1.000 € → Netto 900 €.
5. Bestehende versendete Angebote → unverändert (immutable).

## Risiko

Gering, da:
- Keine DB-Migration, kein neues Feld.
- Versendete Angebote sind eingefroren.
- Änderungen rein in 3 Dateien, gut testbar mit den 5 Schritten oben.
- Wichtig: Punkt 4 (`useOfferBuilder.ts`) ist **die** kritische Stelle — falsche Logik dort verändert den tatsächlich gespeicherten/versendeten Total. Wird mit Smoke-Test 1 verifiziert.
