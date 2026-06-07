
## Zwei Szenarien, klare Trennung

### Szenario A — Anzahlung vorab via Stripe + Restzahlung VOR ORT
- **Keine LexOffice-Anzahlungsrechnung.** Nur eine bilinguale Stripe-Quittung / Zahlungsbestätigung per E-Mail an den Kunden.
- **Keine LexOffice-Schlussrechnung.** Das POS-System vor Ort erstellt den finalen Bewirtungsbeleg / die Schlussrechnung und zieht dort die bereits geleistete Anzahlung ab.
- LexOffice bleibt in diesem Fall komplett außen vor — das verhindert die doppelte Rechnungsstellung (LexOffice + POS), die du vermeiden willst.

### Szenario B — Anzahlung vorab + Restzahlung ebenfalls vorab (Stripe oder Überweisung)
- **LexOffice-Anzahlungsrechnung** wird automatisch nach Zahlungseingang erzeugt (UStG-konform, Brutto, USt separat).
- **LexOffice-Schlussrechnung** mit transparentem Abzug der Anzahlung: z. B. „Gesamt 1.500 € − Anzahlung vom TT.MM.JJJJ (Rechnung Nr. RE-…) 100 € = 1.400 € offen“ (§ 14 Abs. 5 UStG).

---

## Status quo

### Bereits korrekt
1. **Schlussrechnung mit Abzug** (`create-lexoffice-final-invoice`) sammelt alle bezahlten Anzahlungen mit `lexoffice_invoice_id` und übergibt sie als negative Abzugszeilen (`downPaymentDeductions`) an `create-event-quotation`. Dein 1.500 / 100 / 1.400-Beispiel funktioniert.
2. **on_site-Guard auf Schlussrechnungs-Ebene** (`create-lexoffice-final-invoice` Zeilen 43–69): blockt jede LexOffice-Schlussrechnung wenn `balance_method ∈ {on_site, onsite, cash, card_onsite}`. Activity-Log `final_invoice_skipped_on_site`.
3. **UI-Guard** (`SmartInquiryEditor`, `SendInvoiceDialog`): „Rechnung schicken (Vorschau)“-Button bei `on_site` deaktiviert, mit Tooltip/Hinweis.
4. **Webhook-Routing** (`handle-stripe-webhook`): nur `payment_type=final` triggert die Schlussrechnung. Bei `on_site` wird ohnehin nie ein `final`-Stripe-Payment angelegt.
5. **Stripe-Zahlungsbestätigung an den Kunden** (`send-payment-confirmation-v2`): bilinguale Bestätigungs-E-Mail nach jeder Stripe-Zahlung. Hat bereits einen Sonderzweig für `balance_method=on_site` (Restbetrag „vor Ort beim Event“).
6. **Bestätigungstext-Differenzierung** nach `balance_method` (on_site / invoice_after / invoice_before / stripe_prepay) ist in `send-payment-confirmation-v2` bereits sprachlich umgesetzt.

### Lücke (= zu implementieren)
**`create-lexoffice-downpayment-invoice` läuft heute IMMER bei `deposit`/`prepayment`+`paid`** — unabhängig von `balance_method`. Bei Szenario A würde damit eine LexOffice-Anzahlungsrechnung entstehen, obwohl du nur eine Stripe-Quittung willst und die finale Rechnung vom POS kommt. Genau dort entsteht die doppelte Rechnung, die du vermeiden willst.

---

## Implementierungsplan (klein, gezielt)

### 1. `supabase/functions/create-lexoffice-downpayment-invoice/index.ts`
Direkt nach dem bestehenden Idempotenz-Check (vor dem LexOffice-API-Call):
- `v2_events` für `inquiry_id` lesen (`balance_method`).
- Falls `balance_method ∈ {on_site, onsite, cash, card_onsite}` → **skippen** mit `reason: "balance_on_site"`, KEINE LexOffice-Anzahlungsrechnung anlegen.
- Activity-Log `downpayment_invoice_skipped_on_site` mit `payment_id`, `balance_method`, Betrag.
- Response: `{ skipped: true, reason: "balance_on_site", message: "Restzahlung vor Ort — POS erstellt finalen Bewirtungsbeleg inkl. Anzahlungs-Abzug. Kunde erhält nur Stripe-Quittung." }`

Damit erhält der Kunde im on_site-Fall ausschließlich:
- Stripe-Standard-Quittung (von Stripe selbst),
- unsere bilinguale Zahlungsbestätigung aus `send-payment-confirmation-v2` (existiert bereits, Text passt: „begleichen Sie vor Ort beim Event“).

### 2. `send-payment-confirmation-v2` — kleine textuelle Klarstellung im on_site-Zweig
Den Hinweis ergänzen, dass **die finale Schlussrechnung / der Bewirtungsbeleg vor Ort vom Restaurant ausgestellt wird und die bereits geleistete Anzahlung dort transparent abgezogen wird** (DE + EN). Heutiger Text spricht nur über „begleichen vor Ort“, nicht über den Beleg.

### 3. Optional: UI-Hinweis im Inquiry-Editor
Im `SmartInquiryEditor` Zahlungs-Block eine kleine neutrale Info-Pille, sobald Anzahlung bezahlt UND `balance_method=on_site`:
„Anzahlung verbucht. Keine LexOffice-Rechnung — finaler Bewirtungsbeleg inkl. Abzug erfolgt vor Ort über das POS.“
Verhindert versehentliche manuelle Trigger durch Staff.

### 4. Optional: Activity-Log-Erweiterung in `create-lexoffice-final-invoice`
Pro Abzug die Anzahlungs-Rechnungsnummer + Bruttobetrag in `metadata.deductions` mitschreiben (heute nur `deduction_count`). Reine Beobachtbarkeit, kein Verhalten ändert sich.

---

## Nicht zu tun
- Keine Änderung von Beträgen, Rundung oder Steuersätzen (Maestro = Single Source of Truth).
- Keine neue Rechnungsart, kein neuer Stripe-Flow, kein neuer DB-Status.
- Keine Auto-Stornierung bereits existierender LexOffice-Anzahlungsrechnungen aus Altbeständen — falls so ein Fall auftritt, manuell prüfen.
- Keine Marketing-/Massen-E-Mails.

## Buchhalterische Begründung kurz
- Szenario A: Stripe-Anzahlung ist eine **Vereinnahmung ohne Leistungserbringung** — der POS-Beleg vor Ort ist die rechnungsbegründende Endabrechnung gem. § 14 UStG; die Anzahlung wird im POS-Beleg als bereits geleistet ausgewiesen. Doppelte Rechnungslegung durch LexOffice wäre fehlerhaft.
- Szenario B: § 14 Abs. 5 UStG verlangt Schlussrechnung mit Abzug aller geleisteten Anzahlungen unter Angabe der Anzahlungs-Rechnungsnummer und des Datums — exakt das, was `create-lexoffice-final-invoice` heute erzeugt.
