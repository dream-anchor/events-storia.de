## Probleme & Ursachen

**1) AI sagt „Endbetrag brutto 0,00 €"**
`v2_offer_options.amount_total = 0.00` für das Angebot, während `freeformProgram.totalsFromText.gross = 28.460,84 €` und `discount = {mode:'amount', value:3460.84}` (→ effektiv 25.000 €). Edge-Function übergibt `opt.totalAmount` (= 0) als „ENDBETRAG BRUTTO" an die KI.

**2) Freitext-Felder nur teilweise editierbar**
Titel, Zeitraum, Location, Mahlzeit-Label, Personen, Preis, Tax-Breakdown, Totals, Rabatt sind schon editierbar. **Nicht editierbar:** Sections/Headings/Items innerhalb der Mahlzeiten (Gerichte), `scopeOfServices`, `notes`, Tagesdatum.

**3) Bounce-Notification an info@events-storia.de**
Email an Natascha.Morgan@dataguard.com (10.06.2026 13:43, status=bounced, log-id `db7c5076-1ac6-4277-a986-6143e208aa98`) hat `metadata.alert_sent_at = null` → Alarm wurde nie versendet. Einmalig nachholen via `notify-email-failure`.

**4) Rabatt-Anzeige Prozent bei Betrags-Rabatt**
Public Offer (`FreeformProgramSection.tsx` Z. 151) zeigt Prozent nur wenn `mode==='percent'`. Bei `mode==='amount'` soll zusätzlich die effektive Prozentzahl (2 Nachkommastellen) angezeigt werden.

---

## Plan

### A. Edge-Function `generate-inquiry-email` (Endbetrag-Fallback)
In `index.ts`, freeform-Branch (Z. 215–268):
- Effektiven Endbetrag berechnen: `effectiveGross = opt.totalAmount > 0 ? opt.totalAmount : (totalsFromText.gross − discountAmount)`.
- Diesen Wert für „ENDBETRAG BRUTTO" verwenden.
- Falls beide 0 → Hinweis in Kontext „kein Betrag verfügbar — NICHT erfinden, lasse Preis im Anschreiben weg".

Außerdem im System-Prompt (F4): explizit „falls 0,00 € im Kontext steht und totalsFromText.gross > 0 — niemals 0,00 schreiben".

Anschließend `deploy_edge_functions(['generate-inquiry-email'])`.

### B. Freitext-Editor: Gerichte / Hinweise / Datum editierbar
`FreeformProgramEditor.tsx`:
- Pro Mahlzeit: Sections editierbar (Heading-Input + Items als bearbeitbare Zeilen mit „+ Zeile" und „× entfernen"). Neue Section hinzufügen / Section entfernen.
- Tagesdatum-Label editierbar (Input statt `<span>`), + „Mahlzeit hinzufügen / löschen" und „Tag hinzufügen / löschen".
- `scopeOfServices` (Leistungsumfang) und `notes` (Hinweise) als editierbare Textareas (eine Zeile = ein Eintrag) ergänzen.
- MwSt-Sätze (`foodVatRate`, `servicesVatRate`) als Input mit Prozent.

UI behält das bestehende Premium-Light-Layout (rounded-2xl, neutrale Grautöne, keine neuen Farben).

### C. Public Offer: Prozent bei Betrags-Rabatt anzeigen
`FreeformProgramSection.tsx` Z. 151:
```
Rabatt{d?.mode === 'percent' ? ` (${d.value}%)` : ''}
```
→ wenn `mode==='amount'` und `totalsFromText.gross > 0`:
`(${(d.value / totalsFromText.gross * 100).toFixed(2)}%)`.
Gilt für beide Modi: Prozent immer auf 2 Nachkommastellen.

### D. Bounce-Alarm einmalig nachholen
`supabase--curl_edge_functions` POST `/notify-email-failure` mit `{ deliveryLogId: "db7c5076-1ac6-4277-a986-6143e208aa98" }`. Setzt `metadata.alert_sent_at` automatisch (idempotent).

---

## Touched files
- `supabase/functions/generate-inquiry-email/index.ts`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformProgramEditor.tsx`
- `src/pages/public-offer/FreeformProgramSection.tsx`
- Edge-Call: `notify-email-failure` (kein Code-Change)

Keine DB-Migrations, keine neuen Routen.
