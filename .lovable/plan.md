## Problem

In Maestro ist gewählt:
- **Anzahlung:** Vor Ort (Bar / EC)
- **Restzahlung:** Vor Ort beim Event

Auf der LexOffice-Rechnung erscheint aber:
> Anzahlung 20%, Restbetrag fällig 10 Tage vor der Veranstaltung. Vielen Dank für Ihre Buchung.

Das ist sachlich falsch — es gibt keine 10-Tage-Frist, die Restzahlung erfolgt vor Ort.

## Ursache

In `supabase/functions/create-event-quotation/index.ts` (Block `isInvoiceMode && isFinalInvoice`, Zeilen 1177–1212):

1. `labelForMethod()` kennt nur die Werte `cash` / `card_onsite` / `onsite`, aber Maestro speichert `on_site` (mit Unterstrich). Folge: `methodLabel` und `depLabel` sind leer.
2. Der Satzbau erzwingt unabhängig von der Methode immer `… fällig X Tage vor der Veranstaltung`. Für „Vor Ort"-Restzahlung ist das falsch — es muss `… vor Ort beim Event` heißen.
3. Analog für die Anzahlung: bei `on_site` darf keine Tages-Frist erscheinen.

## Fix (nur Edge Function, keine DB / kein Frontend)

**Datei:** `supabase/functions/create-event-quotation/index.ts`

1. **`labelForMethod()` erweitern** — `case 'on_site'` ergänzen, gleicher Rückgabewert wie `cash`/`card_onsite` (`'vor Ort (Bar / EC)'`).

2. **Helper `isOnSite(m)`** einführen (`m === 'on_site' || m === 'cash' || m === 'card_onsite' || m === 'onsite'`).

3. **Branch `isInvoiceMode && isFinalInvoice` (Zeilen 1195–1212) umbauen:**
   - **Restzahlungs-Teil:**
     - Wenn `isOnSite(balanceMethod)` → `paymentTermLabel = 'Restzahlung vor Ort beim Event (Bar / EC)'`, keine Tage-Frist anhängen.
     - Sonst (Stripe / Überweisung / Default): bestehender Satz mit `fällig X Tage vor der Veranstaltung`.
   - **Anzahlungs-Teil (`depInfo`):**
     - Wenn `isOnSite(depositMethod)` → `'Anzahlung 20% vor Ort'` (bzw. fixed amount + `vor Ort`), keine Frist.
     - Sonst unverändert.
   - **Schluss-Satz:** wie bisher zusammengebaut (`{depInfo}, {Restbetrag-Phrase}. Vielen Dank für Ihre Buchung.`).
   - **`paymentTermDuration`:** bleibt auf `dueDays` (LexOffice erwartet eine Zahl ≥ 1); wirkt sich aber nicht mehr auf den sichtbaren Text aus, wenn beide Methoden „Vor Ort" sind.

4. **Edge Function deployen.**

### Beispiele nach dem Fix

| Anzahlung | Restzahlung | Remark-Text |
|-----------|-------------|-------------|
| Vor Ort 20 % | Vor Ort beim Event | `Anzahlung 20% vor Ort, Restbetrag vor Ort beim Event (Bar / EC). Vielen Dank für Ihre Buchung.` |
| Stripe 20 % | Stripe vorab | `Anzahlung 20% per Stripe (Online-Zahlung), Restbetrag per Stripe (Online-Zahlung) — fällig 10 Tage vor der Veranstaltung. Vielen Dank für Ihre Buchung.` |
| Keine | Vor Ort beim Event | `Restzahlung vor Ort beim Event (Bar / EC). Vielen Dank für Ihre Buchung.` |

## Nicht-Ziele

- Keine Änderung an `buildOfferRemark()` (Angebots-Pfad funktioniert bereits korrekt).
- Keine DB-Migration, kein Frontend-Code, keine anderen Edge Functions.
- Bestehende Rechnungen werden nicht rückwirkend geändert.
