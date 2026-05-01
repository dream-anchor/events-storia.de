
# Fix: Alle Audit-Probleme beheben

## Kritische Fehler

### 1. LexOffice Multiplikations-Bug (per_person Modus)
**Datei:** `supabase/functions/create-event-quotation/index.ts`

In der `per_person`-Logik (Zeile 370-414) filtert `drinkTotal` nach `taxRatePercentage === 19`, was Equipment und Staff einschließt. Diese werden dann mit `guestCount - 1` multipliziert, obwohl sie Fixpositionen sind.

**Fix:** Equipment/Staff-Items vor der Multiplikation herausfiltern. Dazu `unitName === 'Stk'` als Ausschlusskriterium nutzen (Getränke haben `unitName: 'Person'`). Equipment/Staff-Items bleiben als separate Fixpositionen stehen und werden nicht multipliziert.

### 2. Fehlende Equipment/Staff in Paket/Email-Modus
**Datei:** `supabase/functions/create-event-quotation/index.ts`

Der `else`-Block (Zeile 416-432) für Paket/Email-Modus erzeugt nur eine Gesamtposition. Equipment und Staff werden ignoriert.

**Fix:** Nach der Gesamtposition im Paket/Email-Block ebenfalls Equipment- und Staff-Zeilen als separate Positionen anfügen (identisch zur Menu-Logik, Zeile 344-368).

### 3. Falsche Gesamtberechnung im Admin-UI
**Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts`

Die `totalAmount`-Berechnung (ab Zeile 640) berücksichtigt weder `equipment` noch `staff`. Beide Summen fehlen.

**Fix:** Equipment- und Staff-Summen berechnen (`sum of pricePerUnit * quantity`) und zum `newTotal` addieren — in beiden Modi (menu und paket). Diese Summen in die dependency-keys (Zeile 721-729) aufnehmen, damit Preisänderungen den Recalc triggern.

### 4. Proportionale Korrektur skaliert Fixkosten
**Datei:** `supabase/functions/create-event-quotation/index.ts`

Im `per_event`-Block (Zeile 181-194) wird ein `factor` berechnet und auf alle Einträge angewendet — auch Equipment/Staff. Das verfälscht Fixkosten.

**Fix:** Equipment/Staff-Einträge vor der proportionalen Korrektur separieren, Faktor nur auf Speisen/Getränke anwenden, dann die Fixpositionen wieder anfügen.

## Mittlere Fehler

### 5. PriceBreakdown ohne Equipment/Staff-Kosten
**Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/PriceBreakdown.tsx`

Equipment- und Staff-Summen werden nicht angezeigt.

**Fix:** Zwei neue Zeilen im Preisüberblick: "Equipment" und "Personal" mit jeweiliger Summe (nur sichtbar wenn > 0).

### 6. Bestätigungsmail ohne Equipment/Staff
**Datei:** `supabase/functions/notify-customer-response/index.ts`

Die Kunden-Bestätigungsmail listet gebuchtes Equipment/Personal nicht auf.

**Fix:** Equipment- und Staff-Items aus `menu_selection` lesen und als Auflistung in die E-Mail einfügen.

### 7. PublicOffer: Preise fehlen, Emojis statt Icons
**Datei:** `src/pages/PublicOffer.tsx`

Equipment/Staff zeigen nur Namen+Mengen, keine Kosten. Außerdem Emojis (🔧👤) statt Lucide-Icons.

**Fix:** Preise pro Zeile anzeigen (Menge x Preis = Summe). Emojis durch Lucide `Wrench`/`Users` Icons ersetzen.

## Kleinere Probleme

### 8. Leere-Namen-Validierung
**Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx`

Leere Namen werden akzeptiert.

**Fix:** Visuelles Feedback (roter Rahmen) bei leerem Namen wenn Preis > 0 oder Menge > 1.

### 9. Fragile Typisierung Activity-Log
**Datei:** `src/hooks/useActivityLog.ts`

Neue Action-Types nicht typisiert.

**Fix:** `offline_booking_confirmed` und andere neue Actions zum Union-Type hinzufügen.

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `supabase/functions/create-event-quotation/index.ts` | Bugs 1, 2, 4 |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` | Bug 3 |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/PriceBreakdown.tsx` | Bug 5 |
| `supabase/functions/notify-customer-response/index.ts` | Bug 6 |
| `src/pages/PublicOffer.tsx` | Bug 7 |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx` | Bug 8 |
| `src/hooks/useActivityLog.ts` | Bug 9 |
