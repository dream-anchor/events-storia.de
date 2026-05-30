## Ausgangslage

Aktuell kann ein Angebot nur über die Public Offer Seite vom Kunden angenommen werden (Button → setzt `offer_phase = order_confirmed`). Wenn der Kunde **telefonisch, per E-Mail oder vor Ort** zusagt, gibt es keinen sauberen Eintrittspunkt:

- Status muss manuell auf "Bestätigt" geklickt werden
- Es wird **keine Rechnung** automatisch erzeugt
- Es wird **keine Bestätigungs-E-Mail** versendet
- Zahlungseinträge müssen separat über `AddPaymentDrawer` angelegt werden

Das Ergebnis: inkonsistente Datenlage zwischen online- und offline-akzeptierten Angeboten, und manuelle Schritte in LexOffice.

## Ziel

**Ein zentraler Aktions-Punkt** im Inquiry-Editor: *"Angebot angenommen"*. Egal ob der Kunde online geklickt oder telefonisch zugesagt hat — danach ist immer derselbe konsistente Zustand erreicht: gebuchtes Event mit der korrekten LexOffice-Rechnung, Zahlungseinträgen und (optional) Bestätigungsmail an den Kunden.

## Vorgeschlagene Lösung

### 1. Neuer Bereich „Angebot annehmen" im Inquiry-Editor

Sichtbar, sobald `offer_phase` mindestens `proposal_sent` oder `final_sent` ist und `status` noch nicht `confirmed`. Position: prominent im Sidebar des SmartInquiryEditor, gleicher visueller Stil wie der bestehende Versand-Bereich.

Inhalt:
- Welches **Angebot/Option** wird angenommen (Dropdown bei Mehr-Optionen-Angeboten, sonst vorausgewählt)
- **Wie hat der Kunde angenommen?**
  - online (vorausgefüllt wenn `offer_phase = order_confirmed`)
  - telefonisch
  - per E-Mail
  - vor Ort / persönlich
- **Datum der Annahme** (Default heute)
- **Anzahl Gäste final** (Default = `guest_count` aus Angebot, editierbar falls Kunde Korrektur durchgegeben hat)
- **Interne Notiz** (optional, z. B. „Christina hat um 14:30 angerufen, alles wie Option A")

### 2. Konsequenzen beim Klick auf „Buchung bestätigen"

Atomarer Ablauf in einer Edge Function `confirm-offer-acceptance`:

1. **Inquiry markieren**
   - `status = 'confirmed'`
   - `offer_phase = 'confirmed'` (falls noch nicht `order_confirmed`)
   - `selected_option_id` setzen
   - `confirmed_at`, `confirmed_via` (online/phone/email/onsite), `confirmed_by` (Admin) eintragen
   - Activity-Log-Eintrag

2. **LexOffice Rechnung erzeugen** — Logik abhängig von `payment_method`:
   | payment_method | Rechnung |
   |---|---|
   | `deposit_online` | Anzahlungsrechnung (`create-lexoffice-downpayment-invoice`) + Restzahlung als Payment-Plan |
   | `invoice_after_event` | Keine sofortige Rechnung, nur Payment-Plan-Eintrag mit Fälligkeit nach Event |
   | `pay_on_site` | Keine Rechnung, Hinweis dass am Eventtag bar bezahlt wird |
   | `prepayment_full` | Vollständige Vorab-Rechnung |

   In jedem Fall werden die zugehörigen `event_payments`-Einträge angelegt (mit Stripe Payment Link wo passend), sodass die `PaymentBalanceCard` sofort die richtigen Beträge zeigt.

3. **Bestätigungsmail an Kunden** (Default an, ausschaltbar im Drawer)
   - Bilinguales Template (DE + EN, wie bestehender Standard)
   - Inhalt: Buchungsdetails, gebuchtes Menü, Zahlungsinfos, Restzahlungsfälligkeit, AGB-Hinweis
   - BCC an `info@events-storia.de`

4. **WhatsApp Alarm** an Admin („Christina hat Angebot angenommen — 4.900 € — 70 Gäste — Anzahlung läuft")

### 3. Online-Annahme bleibt — wird aber transparent dieselbe Logik triggern

Heute setzt der Public-Offer-Klick nur `offer_phase = order_confirmed`. Diesen Schritt erweitern: nach dem Setzen ruft PublicOffer dieselbe `confirm-offer-acceptance` Edge Function auf (mit `confirmed_via = 'online'`). Damit ist online und offline garantiert identisch.

### 4. Idempotenz & Reversibilität

- Funktion prüft, ob bereits eine LexOffice-Rechnung für dieses Inquiry+Option existiert → keine Doppelung
- Falls Admin sich vertut: zusätzlicher Button „Annahme zurücknehmen" (nur sichtbar wenn **keine** Zahlung eingegangen ist und Rechnung noch im Entwurf-Status). Storniert LexOffice-Rechnung, setzt Status zurück auf `offer_sent`.

## Was bleibt unverändert

- Angebots-Immutability: Annahme erstellt **keine** neue Angebots-Version
- `AddPaymentDrawer` bleibt für nachträgliche Zahlungs-Erfassung
- `PaymentBalanceCard` bleibt der zentrale Ort für Zahlungsstatus
- LexOffice Brutto-Preise: alle Beträge 1:1 aus Maestro

## Technische Notizen

- Neue DB-Spalten auf `v2_events`: `confirmed_at TIMESTAMPTZ`, `confirmed_via TEXT`, `confirmed_by UUID`
- Neue Edge Function `confirm-offer-acceptance` (Wrapper, ruft intern die richtige Rechnungs-Function)
- Neue Komponente `OfferAcceptanceDrawer.tsx` im InquiryEditor
- Erweiterung `PublicOffer.tsx` Zeile ~1110: nach `offer_phase = 'order_confirmed'` zusätzlich Edge Function aufrufen
- Activity-Log-Action: `offer_accepted` mit Metadata `{via, option_id, guest_count, invoice_id}`

## Offene Fragen

1. **Soll die Anzahlungsrechnung bei `deposit_online`-Annahme sofort versendet werden**, oder erst nach Klick auf „Rechnung versenden"? (Aktuell: Stripe-Link wird per Bestätigungsmail mitgeschickt — soll das so bleiben?)
2. **Bei `invoice_after_event`**: möchten Sie trotzdem eine **Reservierungsbestätigung** als PDF (keine Rechnung) automatisch erzeugen?
3. **Wenn Kunde am Telefon weniger Gäste sagt** als im Angebot stand: soll die Rechnung den korrigierten Wert nehmen (vermutlich ja, aber Bestätigung wäre gut)?

Wenn diese drei Punkte geklärt sind, kann ich direkt mit der Implementierung starten.