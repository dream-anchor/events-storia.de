

# LexOffice-PDF: Brutto-Behandlung + selected_quantity statt guest_count

## Befund

### Problem 1 — MwSt wird obendrauf statt rausgerechnet
Im Maestro gibt der Admin **Brutto-Preise** ein (z.B. Network-Aperitivo 69 €/Person inkl. MwSt). Aktuelle Logik in `create-event-quotation/index.ts`:
- **Paket-Modus** (Zeile 360–374): `unitPrice.netAmount = totalAmount / guestCount` → 69 € wird als **Netto** an LexOffice gesendet, dann +7% MwSt → 73,83 € Brutto pro Person. Falsch.
- **Menü-Modus** (Zeile 196–358): gleiches Problem mit `course.overridePrice` und `winePairingPrice`.
- Nur `pricingMode === 'per_event'` (Zeile 90–193) macht es bereits korrekt mit `bruttoToNet()`.

**Beweis aus PDF AG0086:** 2 × 10 Personen × 69€/53,30€ → Zwischensumme **netto** 1.223 € + 7% MwSt 85,61 € = 1.308,61 €. Der Admin hat aber 690 € + 533 € = 1.223 € als **Brutto** kalkuliert → korrekt wäre Netto 1.142,99 € + MwSt 80,01 € = **1.223 € Brutto**.

### Problem 2 — Multi-Option: alle Optionen werden mit `guest_count` aufsummiert
Die PDF wird beim Klick auf „Angebot versenden" (`MultiOfferComposer.handleSendOffer`) erstellt — **bevor** der Kunde im Public-Offer auswählt. `create-event-quotation` lädt alle `is_active = true` Optionen und multipliziert jede mit deren `guest_count` (10). Bei 2 aktiven Optionen → 20 Personen-Positionen im PDF, obwohl die Veranstaltung nur 10 Gäste hat.

**Konzeptionelles Problem:** Das LexOffice-Angebot soll dem Kunden zur Buchung präsentiert werden. Bei einem **Multi-Option-Angebot** (Kunde wählt aus A/B/C) ist das PDF zu diesem Zeitpunkt **inhaltlich noch nicht final** — es kann nur die Auswahl des Kunden enthalten, nicht alle Optionen.

## Lösung

### Fix A — Brutto → Netto in allen Pricing-Modi

In `supabase/functions/create-event-quotation/index.ts`:
- `bruttoToNet(brutto, taxPct)` aus dem `per_event`-Branch nach oben in den File-Scope holen.
- **Paket-Modus** (Zeile 361): `netAmount: bruttoToNet(unitPrice, 7)` statt `round2(unitPrice)`. Speisen-Pakete = 7 %, sollten die jemals 19% bekommen müssen → bleibt Annahme 7%.
- **Menü-Modus**: alle Stellen mit `round2(price)` / `round2(course.overridePrice)` / `round2(ms.winePairingPrice)` / `round2(ms.drinksPauschalePrice)` / `round2(drink.pricePerPerson)` umstellen auf `bruttoToNet(...)` mit korrektem Steuersatz (7 % Speisen / 19 % Getränke).
- Zwischensummen-Multiplikation (Zeile 314–358) darf weiterhin auf den bereits umgerechneten Netto-Werten arbeiten — nicht doppelt umrechnen.

Resultat: Admin gibt 69 € ein → LexOffice bekommt 64,49 € netto + 7 % = 69,00 € Brutto → **stimmt mit der Maestro-Anzeige überein**.

### Fix B — Multi-Option-Strategie

**Verhalten beim ersten Versand (Phase „Angebots-Vorschlag"):**
- KEINE LexOffice-Quotation erzeugen. Der Send-Flow überspringt `create-event-quotation`, wenn `activeOptions.length > 1`.
- Der Kunde erhält stattdessen den Public-Offer-Link und entscheidet dort.

**Verhalten nach Kunden-Auswahl (PublicOffer „Jetzt zahlen" oder „Auswahl absenden"):**
- `create-payment-session` schreibt bereits `selected_quantity` pro Option (Zeile 162–168). Direkt im Anschluss ruft die Edge-Function `create-event-quotation` mit einem neuen Flag `useSelectedQuantity: true` auf, sodass das Angebot **erst jetzt** mit den finalen Mengen erstellt wird.
- `create-event-quotation` muss erweitert werden:
  - Wenn `useSelectedQuantity = true`: nur Optionen mit `selected_quantity > 0` einbeziehen, und **anstelle von `guest_count`** die `selected_quantity` als Gäste-Multiplikator verwenden.
  - Sonst (Single-Option, Legacy): unverändert mit `guest_count`.
- ID wird wie bisher in `event_inquiries.lexoffice_quotation_id` persistiert. Falls bereits eine ID existiert (z.B. aus früherer Single-Option), wird **eine neue Quotation** erzeugt und die alte ID einfach überschrieben (LexOffice-Quotations sind immutable; alte bleibt im LexOffice-System bestehen, ist aber für unsere App nicht mehr referenziert).

**Public-Offer-Anzeige (PDF-Karte):**
- In `PublicOffer.tsx` die LexOffice-PDF-Karte **nur dann anzeigen**, wenn `lexoffice_quotation_id` gesetzt ist UND (`activeOptions.length === 1` ODER mind. eine Option mit `selected_quantity > 0` existiert). Bei Multi-Option ohne Auswahl: stattdessen ein freundlicher Hinweis „Das verbindliche Angebots-PDF wird nach Ihrer Auswahl erstellt."

### Verifikations-Trigger

Im `MultiOfferComposer.handleSendOffer`:
```ts
// Nur Quotation generieren, wenn EXAKT eine aktive Option vorhanden ist
if (activeOptions.length === 1) {
  await supabase.functions.invoke('create-event-quotation', { body: { inquiryId: inquiry.id } });
}
```

Im `create-payment-session` nach dem `selected_quantity`-Update:
```ts
// Quotation neu erzeugen mit finalen Mengen
await supabase.functions.invoke('create-event-quotation', {
  body: { inquiryId, useSelectedQuantity: true },
});
```

## Geänderte Dateien

- `supabase/functions/create-event-quotation/index.ts` — `bruttoToNet` global, Brutto-Behandlung in beiden Modi, neuer Parameter `useSelectedQuantity` (~30 Zeilen)
- `supabase/functions/create-payment-session/index.ts` — Re-Trigger der Quotation nach Mengen-Update (~5 Zeilen)
- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` — Quotation nur bei 1 aktiver Option erzeugen (~5 Zeilen)
- `src/pages/PublicOffer.tsx` — PDF-Karte nur bei Single-Option oder vorhandener Auswahl rendern (~10 Zeilen)

Keine DB-Migration. Keine Breaking-Changes für bereits versendete Single-Option-Angebote.

## Verifikation

1. **Brutto-MwSt:** Neues Single-Option-Angebot mit Paket à 99 € (Brutto) für 5 Pers → PDF zeigt Netto 462,62 € + 7% 32,38 € = **495,00 € Brutto** (statt vorher 495 + 7% = 529,65).
2. **Multi-Option vor Auswahl:** Anfrage mit 3 Optionen → versenden → KEIN PDF in PublicOffer, Hinweistext sichtbar. Gäste-Anzahl bleibt korrekt 10 in der LiveCalculation.
3. **Multi-Option nach Auswahl:** Kunde wählt A=4, C=6 → klickt „Jetzt zahlen" → in `event_inquiries.lexoffice_quotation_id` neuer Wert → PDF zeigt Position A × 4 + Position C × 6 = 10 Personen total, Brutto = Summe der Maestro-Anzeige.
4. **Multi-Option PDF nach Stripe-Cancel:** Kunde bricht ab, `selected_quantity` bleibt → PDF zeigt weiterhin die korrekte Auswahl.
5. **AG0086 (bestehende Angebote):** alte Quotation bleibt in LexOffice, neue Sends erzeugen korrekte Werte.

