
# Restzahlung „Vor Ort beim Event" → keine Schlussrechnung über Gesamtbetrag

## Problem
Bei `balance_method = 'on_site'` wird die Restzahlung vor Ort über das Kassensystem (POS) abgewickelt, das selbst einen Beleg/Rechnung erzeugt. Wenn Maestro zusätzlich eine LexOffice-Schlussrechnung über den **Gesamtbetrag** erstellt, existieren **zwei Rechnungen** für denselben Umsatz → buchhalterisch falsch (Doppel-USt-Ausweis, Doppelumsatz).

## Regel
**Wenn `balance_method = 'on_site'` (Bar/EC vor Ort):**
- **Keine Schlussrechnung** über LexOffice. Nie.
- Die **Anzahlungsrechnung** wird zur **endgültigen Rechnung von Maestro** für den Anzahlungsbetrag — inkl. klarem Vermerk:
  - „Bereits bezahlt am TT.MM.JJJJ via Stripe."
  - „Der Restbetrag in Höhe von **X,XX €** wird vor Ort beim Event direkt im Restaurant beglichen und über unser Kassensystem separat quittiert."
- Falls keine Anzahlung vereinbart wurde (`deposit = 'none'` + `balance = 'on_site'`): gar keine LexOffice-Rechnung — alles läuft über das POS.

**Sonst (alle anderen `balance_method`-Werte):** Verhalten bleibt wie aktuell — Schlussrechnung mit Abzug der Anzahlungsrechnungen (§ 14 Abs. 5 UStG).

## Verhalten im UI

| Szenario | „Rechnung schicken · Vorschau" Button | Belege-Liste |
|---|---|---|
| `on_site` + Anzahlung vorhanden | **Deaktiviert** mit Hinweis: „Restzahlung erfolgt vor Ort — keine Schlussrechnung nötig. Anzahlungsrechnung RE00XX gilt als finaler Beleg." | Anzahlungsrechnung sichtbar wie bisher |
| `on_site` + keine Anzahlung | **Deaktiviert** mit Hinweis: „Komplette Zahlung erfolgt vor Ort über das Kassensystem." | Leer (LexOffice-seitig) |
| Alle anderen | Wie bisher (Auto-Regenerate-Logik aus vorherigem Plan) | Wie bisher |

## Umsetzung

### 1. `create-lexoffice-final-invoice/index.ts`
- Nach Idempotenz-Check zusätzlich `inq.balance_method` aus `v2_events` lesen.
- Wenn `balance_method ∈ {'on_site','onsite','cash','card_onsite'}` → **early return**:
  ```json
  { "success": false, "skipped": true, "reason": "balance_on_site",
    "message": "Restzahlung vor Ort — keine Schlussrechnung erlaubt" }
  ```
- Activity-Log-Eintrag `final_invoice_skipped_on_site`.

### 2. `create-lexoffice-downpayment-invoice/index.ts`
- Vor dem Erstellen `balance_method` der zugehörigen Inquiry laden.
- Wenn `on_site`:
  - In `lineItem.description` zusätzlich anhängen:
    > „Der Restbetrag in Höhe von **{remaining} €** wird vor Ort am Veranstaltungstag direkt im Restaurant beglichen und über unser Kassensystem separat quittiert. Diese Rechnung gilt als finaler Beleg über die geleistete Anzahlung."
  - `remark` und Mail-HTML analog ergänzen (DE + EN bilingual gemäß Memory-Regel).
  - `title`: „Anzahlungsrechnung (Restzahlung vor Ort)".

### 3. `SendInvoiceDialog.tsx`
- `balance_method` aus Inquiry lesen.
- Wenn `on_site`:
  - Regenerate-Effect skippen.
  - „Rechnung schicken"-Button `disabled` + Tooltip/Info-Banner mit dem oben genannten Hinweistext.
  - Statt PDF-Vorschau eine Info-Card anzeigen, die auf den Anzahlungsbeleg (oder bei fehlender Anzahlung auf das POS) verweist.

### 4. Auto-Trigger absichern
- Überall, wo `create-lexoffice-final-invoice` automatisch aufgerufen werden könnte (z. B. Status-Wechsel nach Event, Cron-Job), denselben `on_site`-Guard einsetzen — sicherheitshalber im RPC-Aufrufer **und** in der Edge Function.

## Edge Cases
- **Methode wird nach Anzahlungsrechnung geändert** (z. B. von `stripe_prepay` auf `on_site`): Anzahlungsrechnung bleibt unverändert (immutable). Schlussrechnung wird ab dann blockiert. Hinweis im Activity Log.
- **Methode wird von `on_site` auf andere geändert**: Schlussrechnung wieder erlaubt — normaler Flow greift.
- **Bereits versendete Schlussrechnung existiert und Methode wird nachträglich auf `on_site` gestellt**: Storno-Symbol bleibt verfügbar; Admin muss manuell stornieren. Banner im Dialog warnt: „Achtung — Schlussrechnung RE00XX existiert, aber Restzahlung läuft jetzt vor Ort. Bitte Rechnung stornieren."

## Offene Frage
Du hattest vorher 3 Punkte offen gelassen (Trigger-Sicherheit, bilinguale Anzahlungs-Mail, Sichtbarkeit). Sollen die mit hier rein in einen Aufschlag, oder separat in einem zweiten Schritt? Empfehlung: **„bilinguale Anzahlungs-Mail" gleich mit erledigen**, da wir die Mail-Templates für den `on_site`-Hinweis ohnehin anfassen.
